//! REREAL Spitit v3: Groq Whisper transcription client.
//! Ported 1:1 from src/transcriber.py.
//! Handles all language modes including Hinglish with LLM post-processing.

use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const MODEL_WHISPER: &str = "whisper-large-v3";
pub const MODEL_LLM: &str = "llama-3.1-8b-instant";

pub const HINGLISH_WHISPER_PROMPT: &str = "\
Haan bhai, kal subah meeting hai toh sab prepare karke ready rakhna. \
Main thodi der mein call karta hoon, don't worry everything is working smoothly. \
Please check the document and update me on Slack. \
Kya chal raha hai?";

pub const HINGLISH_SYSTEM_PROMPT: &str = "\
You are an expert Hinglish (Hindi + English) text converter for Indian users.
The input is speech-to-text transcript from an Indian speaker speaking Hinglish (Hindi words naturally mixed with English).

CRITICAL RULES:
1. Always write Hindi words in Roman / Latin script (English alphabet), NEVER in Devanagari script (Hindi characters).
   Examples:
   - 'हाँ भाई क्या हाल है' -> 'haan bhai kya haal hai'
   - 'कल मिलते हैं' -> 'kal milte hain'
   - 'काम हो गया' -> 'kaam ho gaya'
   - 'main kal office jaaunga' -> 'main kal office jaaunga'
2. Keep all English words in standard English (e.g. 'meeting', 'project', 'presentation', 'call', 'check', 'send').
3. Do NOT translate Hindi words into English.
4. Do NOT translate English words into Hindi.
5. Preserve the exact words and meaning spoken by the user.
6. Fix phonetic speech-to-text typos in Hindi/English words (e.g. 'kya seen hai' -> 'kya scene hai').
7. Output ONLY the clean Hinglish text in Roman script. No explanations, no quotes, no extra conversational text.";

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
    let has_devanagari = raw_text.chars().any(|c| ('\u{0900}'..='\u{097F}').contains(&c));
    if language == "hinglish" || has_devanagari {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hinglish_prompts() {
        assert!(HINGLISH_WHISPER_PROMPT.contains("Roman/English script"));
        assert!(HINGLISH_WHISPER_PROMPT.contains("NOT Devanagari"));
        assert!(HINGLISH_SYSTEM_PROMPT.contains("convert them to Roman transliteration"));
    }

    #[tokio::test]
    async fn test_empty_api_key_error() {
        let res = transcribe(vec![1, 2, 3], "", "hinglish").await;
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Groq API key is not set"));
    }
}
