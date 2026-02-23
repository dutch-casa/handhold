use base64::Engine;
use std::path::Path;
use std::process::Command;
use tauri::ipc::Channel;

use super::bundle::{bundle_hit, bundle_write};
use super::cache::hash_text;
use super::paths::{resolve_espeak_data_dir, resolve_koko_binary, resolve_models_dir};
use super::synth::synthesize_all_sentences;
use super::timing::{stitch_sentences, text_word_at};
use super::wav::wav_wrap;
use super::TTSEvent;

#[tauri::command]
pub async fn synthesize(
    _app: tauri::AppHandle,
    text: String,
    bundle_path: Option<String>,
    on_event: Channel<TTSEvent>,
) -> Result<(), String> {
    let text_hash = hash_text(&text);

    if let Some(bp) = &bundle_path {
        let bp = Path::new(bp);
        if let Some(bundled) = bundle_hit(bp, text_hash) {
            for &(word_index, char_offset, start_ms, end_ms) in &bundled.timings {
                let _ = on_event.send(TTSEvent::WordBoundary {
                    word: text_word_at(&text, char_offset),
                    word_index,
                    char_offset,
                    start_ms,
                    end_ms,
                });
            }
            let audio_base64 = base64::engine::general_purpose::STANDARD.encode(&bundled.wav_bytes);
            let _ = on_event.send(TTSEvent::AudioReady {
                audio_base64,
                duration_ms: bundled.duration_ms,
            });
            return Ok(());
        }
    }

    let (sentences, sentence_results) = synthesize_all_sentences(&text)?;
    let stitched = stitch_sentences(&text, &sentences, &sentence_results)?;

    for &(word_index, char_offset, start_ms, end_ms) in &stitched.timings {
        let _ = on_event.send(TTSEvent::WordBoundary {
            word: text_word_at(&text, char_offset),
            word_index,
            char_offset,
            start_ms,
            end_ms,
        });
    }

    let wav = wav_wrap(&stitched.pcm, stitched.sample_rate);
    let audio_base64 = base64::engine::general_purpose::STANDARD.encode(&wav);
    let _ = on_event.send(TTSEvent::AudioReady {
        audio_base64,
        duration_ms: stitched.duration_ms,
    });

    Ok(())
}

#[tauri::command]
pub async fn export_audio(texts: Vec<String>, bundle_dir: String) -> Result<usize, String> {
    let bp = Path::new(&bundle_dir);
    let _ = std::fs::create_dir_all(bp);

    let mut exported = 0usize;
    for text in &texts {
        let text_hash = hash_text(text.as_str());

        if bp.join(format!("{text_hash:016x}.wav")).exists() {
            continue;
        }

        let (sentences, sentence_results) = synthesize_all_sentences(text)?;
        let stitched = stitch_sentences(text, &sentences, &sentence_results)?;
        let wav = wav_wrap(&stitched.pcm, stitched.sample_rate);

        bundle_write(bp, text_hash, &wav, &stitched.timings);
        exported += 1;
    }

    Ok(exported)
}

#[tauri::command]
pub async fn ensure_tts_ready() -> Result<String, String> {
    let koko_bin = resolve_koko_binary()?;
    let models_dir = resolve_models_dir()?;
    let model_path = models_dir.join("kokoro-v1.0.onnx");
    let voices_path = models_dir.join("voices-v1.0.bin");
    let espeak_data_dir = resolve_espeak_data_dir();

    if model_path.exists() && voices_path.exists() {
        return Ok("ready".to_string());
    }

    let tmp_wav = std::env::temp_dir().join("handhold_tts_warmup.wav");
    let wav_str = tmp_wav.to_string_lossy().to_string();
    let mut cmd = Command::new(&koko_bin);
    if let Some(dir) = espeak_data_dir {
        cmd.env("ESPEAK_DATA_PATH", dir);
    }
    let output = cmd
        .args([
            "-m",
            &model_path.to_string_lossy(),
            "-d",
            &voices_path.to_string_lossy(),
            "--mono",
            "text",
            "ready",
            "-o",
            &wav_str,
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run koko warmup: {e}"))?;

    let _ = std::fs::remove_file(&tmp_wav);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "TTS warmup failed: {stderr} {stdout} (model: {}, voices: {})",
            model_path.to_string_lossy(),
            voices_path.to_string_lossy()
        ));
    }

    Ok("downloaded".to_string())
}
