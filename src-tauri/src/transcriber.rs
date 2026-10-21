//! REREAL Spitit v3: Groq Whisper transcription client.
//! Uses whisper-large-v3-turbo for lightning-fast sub-second speech recognition.
//! Preserves Hinglish prompt guidance and LLaMA 3.1 cleanup logic.

use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const MODEL_WHISPER: &str = "whisper-large-v3-turbo";
pub const MODEL_LLM_PRIMARY: &str = "llama-3.3-70b-versatile";
pub const MODEL_LLM_FALLBACK: &str = "llama-3.1-8b-instant";



pub const ENGLISH_WHISPER_PROMPT: &str = "\
Verbatim transcription in clear English. Transcribe every word exactly as spoken with proper capitalization, accurate spelling, and punctuation. Do not summarize or skip words.";

pub const HINGLISH_WHISPER_PROMPT: &str = "\
Transcribe Indian English and Hinglish in Roman/English script only (NOT Devanagari). \
Haan bhai, kal subah meeting hai toh sab prepare karke ready rakhna. \
Main thodi der mein call karta hoon, don't worry everything is working smoothly. \
Please check the document and update me on Slack. Kya chal raha hai? \
Woh cheez kaam kar rahi hai, mujhe pata hai.";

pub const HINGLISH_SYSTEM_PROMPT: &str = "\
You are an expert speech-to-text normalizer for Indian English and Hinglish (Hindi + English) users.
The user's speech was transcribed by a speech recognition model, which frequently introduces phonetic typos, misheard words, and weird spelling for Indian expressions.

CRITICAL RULES:
1. Fix all speech-to-text phonetic mishearings and typos into natural, correct words.
   Examples of mishearings to fix:
   - 'woha chis kama nahi kar raha' / 'woha chis' -> 'woh cheez kaam nahi kar raha' / 'woh cheez'
   - 'Main ko nahi pata kiyo' -> 'Mujhe nahi pata kyu'
   - 'jab chote audio hootethe, tab hii kama karta hai' -> 'jab chhote audio hote the, tab hi kaam karta hai'
   - 'Jaysse agar ma bhoat bada audio ik bana dhu' -> 'Jaise agar main bohot bada audio ek bana doon'
   - 'çarhi raman ga dhu' / 'çari' -> 'saari baatein bol doon' / 'saari command daal doon'
   - 'naihi' / 'nahi kar pa raha' -> 'nahi kar pa raha'
   - 'kya seen hai' -> 'kya scene hai'
   - 'jho' -> 'jo'
2. Always write Hindi words in clean Roman/Latin script (English alphabet), NEVER in Devanagari script.
   If input contains any Devanagari characters, convert them to natural Roman script.
3. Keep all English words in standard English (e.g. 'audio', 'feature', 'English', 'meeting', 'project', 'presentation', 'call', 'check', 'send').
4. Do NOT translate Hindi words into English, and do NOT translate English words into Hindi. Preserve the user's natural mixing and intent.
5. Fix punctuation, capitalization, and sentence boundaries.
6. Output ONLY the cleaned, natural transcript text. NEVER include commentary, markdown quotes, notes, or explanations.";

pub const MIXED_HI_EN_PROMPT: &str = "\
The speaker switches between Hindi and English. \
Transcribe Hindi speech in Devanagari script and English speech in English. \
Do not translate — preserve the exact language used for each word.";

pub const WHISPER_LANG_CODES: &[&str] = &[
    "en", "hi", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh",
];

#[allow(dead_code)]
pub fn get_languages() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("Auto-detect", "auto");
    m.insert("English", "en");
    m.insert("Hinglish", "hinglish");
    m.insert("Hindi", "hi");
    m.insert("Hindi + English Mix", "mixed_hi_en");
    m.insert("Spanish", "es");
    m.insert("French", "fr");
    m.insert("German", "de");
    m.insert("Italian", "it");
    m.insert("Portuguese", "pt");
    m.insert("Russian", "ru");
    m.insert("Japanese", "ja");
    m.insert("Korean", "ko");
    m.insert("Chinese", "zh");
    m
}

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Deserialize)]
struct ChatCompletionChoice {
    message: ChatResponseMessage,
}

#[derive(Deserialize)]
struct ChatResponseMessage {
    content: String,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatCompletionChoice>,
}

/// Transcribe in-memory WAV audio bytes using Groq Whisper API.
pub async fn transcribe(
    wav_bytes: Vec<u8>,
    api_key: &str,
    language: &str,
) -> Result<String, String> {
    let trimmed_key = api_key.trim();
    if trimmed_key.is_empty() {
        return Err("ERR_NO_API_KEY: Groq API key is not configured.".into());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| format!("ERR_NETWORK: Client error: {e}"))?;

    // Prepare multipart form
    let file_part = Part::bytes(wav_bytes)
        .file_name("recording.wav")
        .mime_str("audio/wav")
        .map_err(|e| format!("Failed to create audio part: {e}"))?;

    let mut form = Form::new()
        .text("model", MODEL_WHISPER.to_string())
        .text("response_format", "text".to_string())
        .text("temperature", "0.0")
        .part("file", file_part);

    // Apply language-specific configuration
    match language {
        "en" => {
            form = form
                .text("language", "en")
                .text("prompt", ENGLISH_WHISPER_PROMPT);
        }
        "hi" => {
            form = form.text("language", "hi");
        }
        "auto" => {
            // Whisper auto-detects
        }
        "hinglish" => {
            form = form.text("prompt", HINGLISH_WHISPER_PROMPT);
        }
        "mixed_hi_en" => {
            form = form.text("prompt", MIXED_HI_EN_PROMPT);
        }
        other if WHISPER_LANG_CODES.contains(&other) => {
            form = form.text("language", other.to_string());
        }
        _ => {}
    }

    let resp_res = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .bearer_auth(trimmed_key)
        .multipart(form)
        .send()
        .await;

    let resp = match resp_res {
        Ok(r) => r,
        Err(e) => {
            if e.is_timeout() {
                return Err(
                    "ERR_NETWORK: Transcription timed out. Check your internet connection.".into(),
                );
            } else if e.is_connect() {
                return Err(
                    "ERR_NETWORK: No internet connection. Could not reach Groq API.".into(),
                );
            } else {
                return Err(format!("ERR_NETWORK: Network failure: {e}"));
            }
        }
    };

    let status = resp.status();
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err(
            "ERR_RATE_LIMIT: Groq rate limit reached (HTTP 429). Please wait a moment.".into(),
        );
    }

    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(
            "ERR_INVALID_KEY: Invalid Groq API key. Please check your key in Settings.".into(),
        );
    }

    if !status.is_success() {
        let err_text = resp
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        if err_text.contains("rate_limit") || err_text.contains("tokens per minute") {
            return Err("ERR_RATE_LIMIT: Groq rate limit reached.".into());
        }
        return Err(format!("ERR_API: Groq API error ({status}): {err_text}"));
    }

    let mut raw_text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {e}"))?
        .trim()
        .to_string();

    if raw_text.is_empty() {
        return Err("ERR_NO_SPEECH: We couldn't hear you. No speech was detected.".into());
    }

    // Hinglish post-processing through Groq LLM: runs for hinglish mode or if Devanagari script is detected
    let has_devanagari = raw_text
        .chars()
        .any(|c| ('\u{0900}'..='\u{097F}').contains(&c));
    if language == "hinglish" || has_devanagari {
        raw_text = hinglish_cleanup(&client, trimmed_key, &raw_text).await;
    }

    Ok(raw_text)
}

/// Post-process Hinglish transcription through Groq LLM (llama-3.3-70b-versatile with llama-3.1-8b fallback).
pub async fn hinglish_cleanup(client: &reqwest::Client, api_key: &str, raw_text: &str) -> String {
    for model_name in [MODEL_LLM_PRIMARY, MODEL_LLM_FALLBACK] {
        let payload = ChatCompletionRequest {
            model: model_name.to_string(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: HINGLISH_SYSTEM_PROMPT.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: raw_text.to_string(),
                },
            ],
            temperature: 0.05,
            max_tokens: 1024,
        };

        if let Ok(resp) = client
            .post("https://api.groq.com/openai/v1/chat/completions")
            .bearer_auth(api_key.trim())
            .json(&payload)
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(body) = resp.json::<ChatCompletionResponse>().await {
                    if let Some(choice) = body.choices.first() {
                        let cleaned = choice.message.content.trim().to_string();
                        let cleaned = cleaned.trim_matches('"').trim_matches('\'').trim();
                        if !cleaned.is_empty() {
                            return cleaned.to_string();
                        }
                    }
                }
            } else {
                let status = resp.status();
                let err = resp.text().await.unwrap_or_default();
                eprintln!("[Spitit Hinglish LLM {model_name}] HTTP {status}: {err}");
            }
        }
    }
    raw_text.to_string()
}



/// Test connection to Groq API.
pub async fn test_connection(api_key: &str) -> Result<String, String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("No API key provided.".into());
    }
    if !trimmed.starts_with("gsk_") {
        return Err("Invalid API key format (should start with 'gsk_').".into());
    }

    // Generate 1-second silent WAV in-memory
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut cursor = std::io::Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec)
            .map_err(|e| format!("Wav encode error: {e}"))?;
        for _ in 0..16000 {
            let _ = writer.write_sample(0i16);
        }
        let _ = writer.finalize();
    }

    let wav_bytes = cursor.into_inner();
    let client = reqwest::Client::new();
    let file_part = Part::bytes(wav_bytes)
        .file_name("test.wav")
        .mime_str("audio/wav")
        .map_err(|e| format!("Part error: {e}"))?;

    let form = Form::new()
        .text("model", MODEL_WHISPER.to_string())
        .text("response_format", "text".to_string())
        .text("language", "en".to_string())
        .part("file", file_part);

    let resp_res = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .bearer_auth(trimmed)
        .multipart(form)
        .send()
        .await;

    let resp = resp_res.map_err(|e| {
        if e.is_connect() {
            "Connection failed: No internet connection.".to_string()
        } else {
            format!("Connection failed: {e}")
        }
    })?;

    if resp.status().is_success() {
        Ok("Connection verified! Whisper Large v3 Turbo is active.".into())
    } else {
        let status = resp.status();
        let err_text = resp.text().await.unwrap_or_default();
        if status == reqwest::StatusCode::UNAUTHORIZED {
            Err("Authentication failed: Invalid Groq API key.".into())
        } else if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            Err("Rate limit reached on Groq API.".into())
        } else {
            Err(format!("Connection failed ({status}): {err_text}"))
        }
    }
}
