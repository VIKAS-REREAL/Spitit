//! REREAL Spitit v3: Thread-Safe Audio Recorder with WASAPI & 16kHz Resampling.
//! Complies with Sections 3.4, 3.5, 4.3, 4.5:
//! 1. Thread-safe architecture: cpal::Stream lives exclusively on a dedicated audio thread (zero unsafe Send/Sync).
//! 2. Real-time mic level streaming (30-50 Hz) with noise-floor filtering.
//! 3. Hard 90-second max limit with 10-second countdown notifications and automatic stop.
//! 4. Silence trimming before upload (leading and trailing dead air trimmed with safety pad).
//! 5. Microphone device selection with fallback to system default.
//! 6. Honest error diagnostics for device failure, permissions, and mute.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

pub const TARGET_SAMPLE_RATE: u32 = 16000;
pub const MIN_DURATION_SECS: f32 = 0.25;
pub const MAX_DURATION_SECS: f32 = 90.0;
pub const COUNTDOWN_THRESHOLD_SECS: f32 = 80.0;
pub const DEFAULT_SILENCE_THRESHOLD: f32 = 0.0015;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceInfo {
    pub name: String,
    pub is_default: bool,
}

enum AudioCommand {
    Start {
        device_name: Option<String>,
        reply: Sender<Result<(), String>>,
    },
    Stop {
        reply: Sender<Result<Option<Vec<u8>>, String>>,
    },
    Cancel,
}

pub struct AudioRecorder {
    cmd_tx: Sender<AudioCommand>,
    #[allow(dead_code)]
    is_recording: Arc<AtomicBool>,
    last_duration_secs: Arc<Mutex<f32>>,
}

impl AudioRecorder {
    pub fn new<FLevel, FCountdown, FAutoStop>(
        on_mic_level: FLevel,
        on_countdown: FCountdown,
        on_auto_stop: FAutoStop,
    ) -> Self
    where
        FLevel: Fn(f32) + Send + 'static,
        FCountdown: Fn(u32) + Send + 'static,
        FAutoStop: Fn() + Send + 'static,
    {
        let (cmd_tx, cmd_rx) = channel::<AudioCommand>();
        let is_recording = Arc::new(AtomicBool::new(false));
        let last_duration_secs = Arc::new(Mutex::new(0.0f32));

        let is_rec_worker = Arc::clone(&is_recording);
        let last_dur_worker = Arc::clone(&last_duration_secs);

        // Dedicated audio worker thread — keeps cpal::Stream completely contained
        thread::spawn(move || {
            run_audio_worker(
                cmd_rx,
                is_rec_worker,
                last_dur_worker,
                on_mic_level,
                on_countdown,
                on_auto_stop,
            );
        });

        Self {
            cmd_tx,
            is_recording,
            last_duration_secs,
        }
    }

    #[allow(dead_code)]
    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    pub fn get_last_duration(&self) -> f32 {
        *self.last_duration_secs.lock().unwrap()
    }

    pub fn start(&self, device_name: Option<String>) -> Result<(), String> {
        let (tx, rx) = channel();
        self.cmd_tx
            .send(AudioCommand::Start {
                device_name,
                reply: tx,
            })
            .map_err(|e| format!("Audio thread communication error: {e}"))?;
        rx.recv()
            .map_err(|e| format!("Audio thread reply error: {e}"))?
    }

    pub fn stop(&self) -> Result<Option<Vec<u8>>, String> {
        let (tx, rx) = channel();
        self.cmd_tx
            .send(AudioCommand::Stop { reply: tx })
            .map_err(|e| format!("Audio thread communication error: {e}"))?;
        rx.recv()
            .map_err(|e| format!("Audio thread reply error: {e}"))?
    }

    pub fn cancel(&self) {
        let _ = self.cmd_tx.send(AudioCommand::Cancel);
    }
}

pub fn list_input_devices() -> Vec<AudioDeviceInfo> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok())
        .unwrap_or_default();

    let mut list = Vec::new();
    if let Ok(devices) = host.input_devices() {
        for d in devices {
            if let Ok(name) = d.name() {
                let is_default = name == default_name;
                list.push(AudioDeviceInfo { name, is_default });
            }
        }
    }
    list
}

fn run_audio_worker<FLevel, FCountdown, FAutoStop>(
    cmd_rx: Receiver<AudioCommand>,
    is_rec_flag: Arc<AtomicBool>,
    last_dur_store: Arc<Mutex<f32>>,
    on_mic_level: FLevel,
    on_countdown: FCountdown,
    on_auto_stop: FAutoStop,
) where
    FLevel: Fn(f32) + Send + 'static,
    FCountdown: Fn(u32) + Send + 'static,
    FAutoStop: Fn() + Send + 'static,
{
    let mut active_stream: Option<cpal::Stream> = None;
    let mut audio_buffer: Arc<Mutex<Vec<i16>>> = Arc::new(Mutex::new(Vec::new()));
    let mut stream_sample_rate = TARGET_SAMPLE_RATE;
    let mut start_instant: Option<Instant> = None;
    let mut last_countdown_secs = 0u32;
    let mut auto_stopped = false;

    let sample_counter = Arc::new(std::sync::atomic::AtomicUsize::new(0));

    loop {
        // Non-blocking poll for commands with a short timeout to handle live RMS level updates & 90s auto-stop
        match cmd_rx.recv_timeout(Duration::from_millis(25)) {
            Ok(AudioCommand::Start { device_name, reply }) => {
                if is_rec_flag.load(Ordering::SeqCst) {
                    let _ = reply.send(Ok(()));
                    continue;
                }

                auto_stopped = false;
                last_countdown_secs = 0;
                let host = cpal::default_host();

                // Select device or fall back to default
                let device = match device_name {
                    Some(name) if !name.is_empty() && name != "System default" => {
                        let mut found = None;
                        if let Ok(devices) = host.input_devices() {
                            for d in devices {
                                if let Ok(n) = d.name() {
                                    if n == name {
                                        found = Some(d);
                                        break;
                                    }
                                }
                            }
                        }
                        found.or_else(|| host.default_input_device())
                    }
                    _ => host.default_input_device(),
                };

                let device = match device {
                    Some(d) => d,
                    None => {
                        let _ = reply.send(Err("ERR_NO_DEVICE: No audio input device found. Check your microphone in Windows Settings.".into()));
                        continue;
                    }
                };

                let config_res = device.default_input_config();
                let config = match config_res {
                    Ok(c) => c,
                    Err(e) => {
                        let _ = reply.send(Err(format!("ERR_DEVICE_BUSY: Failed to access microphone ({e}). It may be in exclusive use.")));
                        continue;
                    }
                };

                let dev_rate = config.sample_rate().0;
                let channels = config.channels() as usize;
                stream_sample_rate = dev_rate;

                audio_buffer = Arc::new(Mutex::new(Vec::with_capacity(dev_rate as usize * 10)));
                let buf_clone = Arc::clone(&audio_buffer);
                let rec_flag_clone = Arc::clone(&is_rec_flag);
                let counter_clone = Arc::clone(&sample_counter);

                let err_fn = |err| eprintln!("[Spitit Audio Stream Error] {err}");

                let stream_res = match config.sample_format() {
                    cpal::SampleFormat::F32 => device.build_input_stream(
                        &config.into(),
                        move |data: &[f32], _: &_| {
                            if !rec_flag_clone.load(Ordering::SeqCst) {
                                return;
                            }
                            let mut buf = buf_clone.lock().unwrap();
                            for frame in data.chunks(channels) {
                                let sum: f32 = frame.iter().copied().sum();
                                let mono = sum / channels as f32;
                                let sample_i16 = (mono.clamp(-1.0, 1.0) * 32767.0) as i16;
                                buf.push(sample_i16);
                            }
                            counter_clone.fetch_add(data.len() / channels, Ordering::Relaxed);
                        },
                        err_fn,
                        None,
                    ),
                    cpal::SampleFormat::I16 => device.build_input_stream(
                        &config.into(),
                        move |data: &[i16], _: &_| {
                            if !rec_flag_clone.load(Ordering::SeqCst) {
                                return;
                            }
                            let mut buf = buf_clone.lock().unwrap();
                            for frame in data.chunks(channels) {
                                let sum: i32 = frame.iter().map(|&s| s as i32).sum();
                                let mono = (sum / channels as i32) as i16;
                                buf.push(mono);
                            }
                            counter_clone.fetch_add(data.len() / channels, Ordering::Relaxed);
                        },
                        err_fn,
                        None,
                    ),
                    _ => {
                        let _ = reply.send(Err("ERR_AUDIO_FORMAT: Unsupported microphone sample format.".into()));
                        continue;
                    }
                };

                match stream_res {
                    Ok(stream) => {
                        if let Err(e) = stream.play() {
                            let _ = reply.send(Err(format!("ERR_DEVICE_BUSY: Could not start audio stream: {e}")));
                            continue;
                        }
                        active_stream = Some(stream);
                        is_rec_flag.store(true, Ordering::SeqCst);
                        start_instant = Some(Instant::now());
                        let _ = reply.send(Ok(()));
                    }
                    Err(e) => {
                        let _ = reply.send(Err(format!("ERR_PERMISSION_DENIED: Failed to initialize microphone: {e}")));
                    }
                }
            }

            Ok(AudioCommand::Stop { reply }) => {
                is_rec_flag.store(false, Ordering::SeqCst);
                if let Some(s) = active_stream.take() {
                    let _ = s.pause();
                }

                let elapsed = start_instant.map(|t| t.elapsed().as_secs_f32()).unwrap_or(0.0);
                *last_dur_store.lock().unwrap() = elapsed;
                start_instant = None;

                if elapsed < MIN_DURATION_SECS {
                    let _ = reply.send(Ok(None));
                    continue;
                }

                let raw_samples = {
                    let buf = audio_buffer.lock().unwrap();
                    buf.clone()
                };

                if raw_samples.is_empty() {
                    let _ = reply.send(Ok(None));
                    continue;
                }

                // Check silence threshold on raw samples
                if is_silent(&raw_samples, DEFAULT_SILENCE_THRESHOLD) {
                    let _ = reply.send(Err("ERR_NO_SPEECH: We couldn't hear you. Audio was silent or below volume threshold.".into()));
                    continue;
                }

                // Resample to 16kHz mono
                let resampled = resample_to_16k(&raw_samples, stream_sample_rate);

                // Trim leading & trailing silences before cloud upload (Section 4.3)
                let trimmed = trim_silence(&resampled, TARGET_SAMPLE_RATE, DEFAULT_SILENCE_THRESHOLD);

                if trimmed.is_empty() || is_silent(&trimmed, DEFAULT_SILENCE_THRESHOLD) {
                    let _ = reply.send(Err("ERR_NO_SPEECH: We couldn't hear you. No audible speech detected.".into()));
                    continue;
                }

                // Encode to in-memory WAV
                match encode_wav(&trimmed, TARGET_SAMPLE_RATE) {
                    Ok(wav) => {
                        let _ = reply.send(Ok(Some(wav)));
                    }
                    Err(e) => {
                        let _ = reply.send(Err(format!("ERR_ENCODE: WAV encoding error: {e}")));
                    }
                }
            }

            Ok(AudioCommand::Cancel) => {
                is_rec_flag.store(false, Ordering::SeqCst);
                if let Some(s) = active_stream.take() {
                    let _ = s.pause();
                }
                audio_buffer.lock().unwrap().clear();
                start_instant = None;
            }

            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                // Audio loop heartbeat: compute mic level & check duration
                if is_rec_flag.load(Ordering::SeqCst) {
                    if let Some(start_t) = start_instant {
                        let elapsed = start_t.elapsed().as_secs_f32();

                        // 1. Check hard 90s limit (Section 4.3)
                        if elapsed >= MAX_DURATION_SECS && !auto_stopped {
                            auto_stopped = true;
                            on_auto_stop();
                        } else if elapsed >= COUNTDOWN_THRESHOLD_SECS {
                            // Countdown in last 10 seconds (80s - 90s)
                            let remaining = (MAX_DURATION_SECS - elapsed).ceil() as u32;
                            if remaining != last_countdown_secs {
                                last_countdown_secs = remaining;
                                on_countdown(remaining);
                            }
                        }

                        // 2. Real-time mic level update (30-50 Hz)
                        let buf_lock = audio_buffer.lock().unwrap();
                        let total_len = buf_lock.len();
                        // Compute RMS on the most recent 1024 samples (~25ms at 44.1k/48k)
                        let window_size = 1024.min(total_len);
                        if window_size > 64 {
                            let slice = &buf_lock[total_len - window_size..];
                            let mut sum_sq: f64 = 0.0;
                            for &s in slice {
                                let norm = s as f64 / 32768.0;
                                sum_sq += norm * norm;
                            }
                            let rms = (sum_sq / window_size as f64).sqrt() as f32;

                            // Apply noise floor gate & gentle boost for visible animation
                            let normalized = if rms < DEFAULT_SILENCE_THRESHOLD {
                                0.0
                            } else {
                                // Scale [threshold .. 0.15] to [0.0 .. 1.0]
                                ((rms - DEFAULT_SILENCE_THRESHOLD) / 0.12).clamp(0.0, 1.0)
                            };
                            on_mic_level(normalized);
                        } else {
                            on_mic_level(0.0);
                        }
                    }
                }
            }

            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                break;
            }
        }
    }
}

/// Trims leading and trailing silence from audio with a 120ms safety pad.
pub fn trim_silence(samples: &[i16], sample_rate: u32, threshold: f32) -> Vec<i16> {
    if samples.is_empty() {
        return Vec::new();
    }

    let window_size = (sample_rate as usize / 50).max(64); // ~20ms window
    let pad_samples = (sample_rate as usize / 8).max(128); // ~120ms pad

    let mut start_idx = 0;
    let mut end_idx = samples.len();

    // Find start (first audible window)
    for (i, window) in samples.chunks(window_size).enumerate() {
        if !is_silent(window, threshold) {
            start_idx = (i * window_size).saturating_sub(pad_samples);
            break;
        }
    }

    // Find end (last audible window)
    let chunks: Vec<_> = samples.chunks(window_size).collect();
    for (i, window) in chunks.iter().enumerate().rev() {
        if !is_silent(window, threshold) {
            end_idx = ((i + 1) * window_size + pad_samples).min(samples.len());
            break;
        }
    }

    if start_idx >= end_idx {
        return Vec::new();
    }

    samples[start_idx..end_idx].to_vec()
}

/// Resamples any source sample rate to exact 16kHz mono using linear interpolation.
pub fn resample_to_16k(input: &[i16], from_rate: u32) -> Vec<i16> {
    if from_rate == TARGET_SAMPLE_RATE || input.is_empty() {
        return input.to_vec();
    }
    let ratio = from_rate as f64 / TARGET_SAMPLE_RATE as f64;
    let target_len = ((input.len() as f64) / ratio).round() as usize;
    let mut output = Vec::with_capacity(target_len);

    for i in 0..target_len {
        let src_idx = (i as f64) * ratio;
        let idx0 = src_idx.floor() as usize;
        let idx1 = (idx0 + 1).min(input.len().saturating_sub(1));
        let frac = src_idx - (idx0 as f64);
        let s0 = input[idx0] as f64;
        let s1 = input[idx1] as f64;
        let interpolated = s0 + frac * (s1 - s0);
        output.push(interpolated.round().clamp(-32768.0, 32767.0) as i16);
    }
    output
}

/// Calculate RMS volume and test if below threshold.
pub fn is_silent(samples: &[i16], threshold: f32) -> bool {
    if samples.is_empty() {
        return true;
    }
    let mut sum_sq: f64 = 0.0;
    for &s in samples {
        let norm = s as f64 / 32768.0;
        sum_sq += norm * norm;
    }
    let rms = (sum_sq / samples.len() as f64).sqrt() as f32;
    rms < threshold
}

/// Encode int16 PCM samples to in-memory WAV bytes.
pub fn encode_wav(samples: &[i16], sample_rate: u32) -> Result<Vec<u8>, String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = std::io::Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec)
            .map_err(|e| format!("Failed to create WavWriter: {e}"))?;
        for &sample in samples {
            writer
                .write_sample(sample)
                .map_err(|e| format!("Wav write error: {e}"))?;
        }
        writer
            .finalize()
            .map_err(|e| format!("Wav finalize error: {e}"))?;
    }

    Ok(cursor.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resampling() {
        // 48kHz to 16kHz
        let input: Vec<i16> = (0..4800).map(|i| (i % 100) as i16).collect();
        let resampled = resample_to_16k(&input, 48000);
        assert_eq!(resampled.len(), 1600);
    }

    #[test]
    fn test_silence_detection() {
        let zeroes = vec![0i16; 1600];
        assert!(is_silent(&zeroes, DEFAULT_SILENCE_THRESHOLD));

        let loud_sine: Vec<i16> = (0..1600)
            .map(|i| ((i as f64 * 0.1).sin() * 20000.0) as i16)
            .collect();
        assert!(!is_silent(&loud_sine, DEFAULT_SILENCE_THRESHOLD));
    }

    #[test]
    fn test_trim_silence() {
        let mut audio = vec![0i16; 3200]; // 200ms silence
        let speech: Vec<i16> = (0..3200)
            .map(|i| ((i as f64 * 0.1).sin() * 20000.0) as i16)
            .collect();
        audio.extend_from_slice(&speech); // 200ms speech
        audio.extend_from_slice(&vec![0i16; 3200]); // 200ms silence

        let trimmed = trim_silence(&audio, 16000, DEFAULT_SILENCE_THRESHOLD);
        assert!(!trimmed.is_empty());
        assert!(trimmed.len() < audio.len());
    }
}
