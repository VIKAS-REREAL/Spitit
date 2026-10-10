//! REREAL Spitit v3: Groq Whisper transcription client.
//! Ported 1:1 from src/transcriber.py.
//! Handles all language modes including Hinglish with LLM post-processing.

use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const MODEL_WHISPER: &str = "whisper-large-v3-turbo";
pub const MODEL_LLM: &str = "llama-3.1-8b-instant";

pub const HINGLISH_WHISPER_PROMPT: &str = "\
The speaker is an Indian person speaking Hinglish — a natural mix of Hindi and English. \
Transcribe all Hindi words in Roman/English script (transliteration), NOT Devanagari. \
English words should remain in English. \
For example: 'yaar kya scene hai' not 'यार क्या सीन है'. \
Another example: 'main kal office jaaunga' not 'मैं कल ऑफिस जाऊंगा'. \
Write exactly what is spoken, do not translate.";

pub const HINGLISH_SYSTEM_PROMPT: &str = "\
You are a Hinglish text normalizer. \
The input is speech-to-text output of someone speaking Hinglish (Hindi words mixed with English, spoken casually).
Your job:
1. If any Hindi words appear in Devanagari script, convert them to Roman transliteration (e.g. 'यार' → 'yaar', 'क्या' → 'kya', 'हो गया' → 'ho gaya')
2. Keep all English words exactly as they are
3. Keep the exact meaning and words — do NOT translate, do NOT rephrase
4. Fix obvious STT errors in context (e.g. \"main kal offer jaaunga\" → \"main kal office jaaunga\" if that makes more sense)
5. Output ONLY the cleaned Hinglish text, nothing else

Examples:
Input: \"यार kya scene hai aaj\"
Output: \"yaar kya scene hai aaj\"

Input: \"I need to submit the report kal tak\"
Output: \"I need to submit the report kal tak\"

Input: \"bhai bahut zyada kaam hai\"
Output: \"bhai bahut zyada kaam hai\"";

pub const MIXED_HI_EN_PROMPT: &str = "\
The speaker switches between Hindi and English. \
Transcribe Hindi speech in Devanagari script and English speech in English. \
Do not translate — preserve the exact language used for each word.";

pub const WHISPER_LANG_CODES: &[&str] = &[
    "en", "hi", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh",
];

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
    if api_key.trim().is_empty() {
        return Err("Groq API key is not set. Please add your key in Settings.".into());
    }

    let client = reqwest::Client::new();

    // Prepare multipart form
    let file_part = Part::bytes(wav_bytes)
        .file_name("recording.wav")
        .mime_str("audio/wav")
        .map_err(|e| format!("Failed to create audio part: {e}"))?;

    let mut form = Form::new()
        .text("model", MODEL_WHISPER.to_string())
        .text("response_format", "text".to_string())
        .part("file", file_part);

    // Apply language-specific configuration identical to transcriber.py
    match language {
        "en" => {
            form = form.text("language", "en");
        }
        "hi" => {
            form = form.text("language", "hi");
        }
        "auto" => {
            // Whisper auto-detects
        }
        "hinglish" => {
            // Prompt guide without forcing language
            form = form.text("prompt", HINGLISH_WHISPER_PROMPT);
        }
        "mixed_hi_en" => {
            form = form.text("prompt", MIXED_HI_EN_PROMPT);
        }
        other if WHISPER_LANG_CODES.contains(&other) => {
            form = form.text("language", other.to_string());
        }
        _ => {
            // Unsupported or fallback: auto-detect
        }
    }

    let resp = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .bearer_auth(api_key.trim())
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Network error sending to Groq: {e}"))?;

    if !resp.status().is_success() {
        let err_text = resp
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Groq API error: {err_text}"));
    }

    let mut raw_text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {e}"))?
        .trim()
        .to_string();

    if raw_text.is_empty() {
        return Err("Transcription returned empty text.".into());
    }

    // Hinglish post-processing: pass through LLM for Roman cleanup
    if language == "hinglish" {
        raw_text = hinglish_cleanup(&client, api_key, &raw_text).await;
    }

    Ok(raw_text)
}

/// Post-process Hinglish transcription through Groq LLM (llama-3.1-8b-instant).
pub async fn hinglish_cleanup(client: &reqwest::Client, api_key: &str, raw_text: &str) -> String {
    let payload = ChatCompletionRequest {
        model: MODEL_LLM.to_string(),
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

    match client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(api_key.trim())
        .json(&payload)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(body) = resp.json::<ChatCompletionResponse>().await {
                if let Some(choice) = body.choices.first() {
                    let cleaned = choice.message.content.trim().to_string();
                    if !cleaned.is_empty() {
                        return cleaned;
                    }
                }
            }
            raw_text.to_string()
        }
        _ => raw_text.to_string(),
    }
}

/// Test connection to Groq API.
pub async fn test_connection(api_key: &str) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("No API key provided.".into());
    }
    if !api_key.trim().starts_with("gsk_") {
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
            writer.write_sample(0i16).unwrap();
        }
        writer.finalize().unwrap();
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

    let resp = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .bearer_auth(api_key.trim())
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Connection failed: {e}"))?;

    if resp.status().is_success() {
        Ok("Connection successful! API key is valid.".into())
    } else {
        let err_text = resp.text().await.unwrap_or_default();
        Err(format!("Connection failed: {err_text}"))
    }
}
