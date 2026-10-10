//! REREAL Spitit v3: Audio recorder.
//! Captures microphone audio using cpal at 16 kHz mono.
//! Stores purely in-memory as WAV bytes with hound. No temporary files.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::Instant;

pub const SAMPLE_RATE: u32 = 16000;
pub const MIN_DURATION_SECS: f32 = 0.3;
pub const MAX_DURATION_SECS: f32 = 120.0;
pub const DEFAULT_SILENCE_THRESHOLD: f32 = 0.01;

pub struct AudioRecorder {
    is_recording: Arc<AtomicBool>,
    buffer: Arc<Mutex<Vec<i16>>>,
    start_time: Arc<Mutex<Option<Instant>>>,
    stream: Option<cpal::Stream>,
}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            buffer: Arc::new(Mutex::new(Vec::new())),
            start_time: Arc::new(Mutex::new(None)),
            stream: None,
        }
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

        // Try to find a config that supports 16kHz, otherwise pick default
        let mut chosen_config = None;
        for c in supported_configs {
            if c.channels() == 1
                && c.min_sample_rate().0 <= SAMPLE_RATE
                && c.max_sample_rate().0 >= SAMPLE_RATE
            {
                chosen_config = Some(c.with_sample_rate(cpal::SampleRate(SAMPLE_RATE)));
                break;
            }
        }

        let config = match chosen_config {
            Some(c) => c,
            None => device
                .default_input_config()
                .map_err(|e| format!("Default config error: {e}"))?,
        };

        let sample_rate = config.sample_rate().0;
        let channels = config.channels() as usize;

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

    /// Stops recording and returns the in-memory WAV bytes.
    /// Returns Ok(None) if audio was shorter than MIN_DURATION_SECS.
    /// Returns Err if audio was pure silence or failed to encode.
    pub fn stop(&mut self) -> Result<Option<Vec<u8>>, String> {
        self.is_recording.store(false, Ordering::SeqCst);

        if let Some(s) = self.stream.take() {
            let _ = s.pause();
        }

        let elapsed = {
            let st = self.start_time.lock().unwrap();
            st.map(|t| t.elapsed().as_secs_f32()).unwrap_or(0.0)
        };

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

        // Check silence threshold
        if is_silent(&raw_samples, DEFAULT_SILENCE_THRESHOLD) {
            return Err("Audio was silent or below volume threshold".into());
        }

        // Encode to in-memory WAV
        let wav_bytes = encode_wav(&raw_samples, SAMPLE_RATE)?;
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
