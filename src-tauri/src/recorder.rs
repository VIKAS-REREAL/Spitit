//! REREAL Spitit v3: Audio recorder with WASAPI native capture & 16kHz resampling.
//! Captures microphone audio at native device sample rate (e.g. 48kHz / 44.1kHz),
//! then resamples cleanly to 16 kHz mono PCM before in-memory WAV encoding.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::Instant;

pub const TARGET_SAMPLE_RATE: u32 = 16000;
pub const MIN_DURATION_SECS: f32 = 0.25;
pub const MAX_DURATION_SECS: f32 = 120.0;
pub const DEFAULT_SILENCE_THRESHOLD: f32 = 0.0015; // Low threshold so quiet mics aren't cut off

pub struct AudioRecorder {
    is_recording: Arc<AtomicBool>,
    buffer: Arc<Mutex<Vec<i16>>>,
    start_time: Arc<Mutex<Option<Instant>>>,
    last_duration_secs: Arc<Mutex<f32>>,
    stream: Option<cpal::Stream>,
    actual_sample_rate: Arc<Mutex<u32>>,
}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            buffer: Arc::new(Mutex::new(Vec::new())),
            start_time: Arc::new(Mutex::new(None)),
            last_duration_secs: Arc::new(Mutex::new(0.0)),
            stream: None,
            actual_sample_rate: Arc::new(Mutex::new(TARGET_SAMPLE_RATE)),
        }
    }

    pub fn get_last_duration(&self) -> f32 {
        *self.last_duration_secs.lock().unwrap()
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    pub fn start(&mut self) -> Result<(), String> {
        if self.is_recording.load(Ordering::SeqCst) {
            return Ok(());
        }

        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| "No default audio input device found".to_string())?;

        let supported_configs = device
            .supported_input_configs()
            .map_err(|e| format!("Failed to query input configs: {e}"))?;

        // Prefer 16kHz if natively supported, otherwise fallback to device default
        let mut chosen_config = None;
        for c in supported_configs {
            if c.channels() == 1
                && c.min_sample_rate().0 <= TARGET_SAMPLE_RATE
                && c.max_sample_rate().0 >= TARGET_SAMPLE_RATE
            {
                chosen_config = Some(c.with_sample_rate(cpal::SampleRate(TARGET_SAMPLE_RATE)));
                break;
            }
        }

        let config = match chosen_config {
            Some(c) => c,
            None => device
                .default_input_config()
                .map_err(|e| format!("Default config error: {e}"))?,
        };

        let device_sample_rate = config.sample_rate().0;
        let channels = config.channels() as usize;
        *self.actual_sample_rate.lock().unwrap() = device_sample_rate;

        // Reset buffer and state
        {
            let mut buf = self.buffer.lock().unwrap();
            buf.clear();
        }
        *self.start_time.lock().unwrap() = Some(Instant::now());
        self.is_recording.store(true, Ordering::SeqCst);

        let buffer_clone = Arc::clone(&self.buffer);
        let recording_flag = Arc::clone(&self.is_recording);
        let start_time_clone = Arc::clone(&self.start_time);

        let err_fn = |err| eprintln!("Audio stream error: {err}");

        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => {
                device.build_input_stream(
                    &config.into(),
                    move |data: &[f32], _: &_| {
                        if !recording_flag.load(Ordering::SeqCst) {
                            return;
                        }

                        // Check max duration
                        if let Some(st) = *start_time_clone.lock().unwrap() {
                            if st.elapsed().as_secs_f32() >= MAX_DURATION_SECS {
                                recording_flag.store(false, Ordering::SeqCst);
                                return;
                            }
                        }

                        let mut buf = buffer_clone.lock().unwrap();
                        for frame in data.chunks(channels) {
                            // Downmix / average channels to mono
                            let sum: f32 = frame.iter().copied().sum();
                            let mono = sum / channels as f32;
                            // Convert float32 [-1.0, 1.0] to int16
                            let clamped = mono.clamp(-1.0, 1.0);
                            let sample_i16 = (clamped * 32767.0) as i16;
                            buf.push(sample_i16);
                        }
                    },
                    err_fn,
                    None,
                )
            }
            cpal::SampleFormat::I16 => {
                device.build_input_stream(
                    &config.into(),
                    move |data: &[i16], _: &_| {
                        if !recording_flag.load(Ordering::SeqCst) {
                            return;
                        }

                        let mut buf = buffer_clone.lock().unwrap();
                        for frame in data.chunks(channels) {
                            let sum: i32 = frame.iter().map(|&s| s as i32).sum();
                            let mono = (sum / channels as i32) as i16;
                            buf.push(mono);
                        }
                    },
                    err_fn,
                    None,
                )
            }
            _ => return Err("Unsupported audio sample format".into()),
        }
        .map_err(|e| format!("Failed to build input stream: {e}"))?;

        stream
            .play()
            .map_err(|e| format!("Failed to start stream: {e}"))?;

        self.stream = Some(stream);
        Ok(())
    }

    /// Stops recording, resamples audio to 16 kHz mono, and returns in-memory WAV bytes.
    pub fn stop(&mut self) -> Result<Option<Vec<u8>>, String> {
        self.is_recording.store(false, Ordering::SeqCst);

        if let Some(s) = self.stream.take() {
            let _ = s.pause();
        }

        let elapsed = {
            let st = self.start_time.lock().unwrap();
            st.map(|t| t.elapsed().as_secs_f32()).unwrap_or(0.0)
        };
        *self.last_duration_secs.lock().unwrap() = elapsed;

        if elapsed < MIN_DURATION_SECS {
            return Ok(None);
        }

        let raw_samples = {
            let buf = self.buffer.lock().unwrap();
            buf.clone()
        };

        if raw_samples.is_empty() {
            return Ok(None);
        }

        // Check silence threshold on raw samples
        if is_silent(&raw_samples, DEFAULT_SILENCE_THRESHOLD) {
            return Err("Audio was silent or below volume threshold".into());
        }

        let source_sample_rate = *self.actual_sample_rate.lock().unwrap();
        // High quality linear interpolation resampling to exact 16000 Hz
        let resampled = resample_to_16k(&raw_samples, source_sample_rate);

        // Encode to in-memory WAV with exact 16 kHz sample rate
        let wav_bytes = encode_wav(&resampled, TARGET_SAMPLE_RATE)?;
        Ok(Some(wav_bytes))
    }

    pub fn cancel(&mut self) {
        self.is_recording.store(false, Ordering::SeqCst);
        if let Some(s) = self.stream.take() {
            let _ = s.pause();
        }
        self.buffer.lock().unwrap().clear();
    }
}

unsafe impl Send for AudioRecorder {}
unsafe impl Sync for AudioRecorder {}

/// Resamples any source sample rate (e.g. 48kHz, 44.1kHz) to exact 16kHz mono using linear interpolation.
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
