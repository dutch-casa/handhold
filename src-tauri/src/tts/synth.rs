use std::path::PathBuf;
use std::process::Command;

use super::cache::{cache_hit, cache_write, hash_text, CachedSentence};
use super::paths::{resolve_espeak_data_dir, resolve_koko_binary, resolve_models_dir};
use super::split::split_sentences;
use super::wav::wav_to_int16_pcm;

const DEFAULT_KOKORO_VOICE: &str = "am_michael";
const FALLBACK_KOKORO_VOICE: &str = "bf_emma";

pub(super) struct KokoContext {
    pub koko_bin: PathBuf,
    pub model_path: PathBuf,
    pub voices_path: PathBuf,
    pub espeak_data_dir: Option<PathBuf>,
    pub tmp_id: u128,
}

pub(super) fn resolve_koko_context() -> Result<KokoContext, String> {
    let koko_bin = resolve_koko_binary()?;
    let models_dir = resolve_models_dir()?;
    let model_path = models_dir.join("kokoro-v1.0.onnx");
    let voices_path = models_dir.join("voices-v1.0.bin");
    let espeak_data_dir = resolve_espeak_data_dir();
    let tmp_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    Ok(KokoContext {
        koko_bin,
        model_path,
        voices_path,
        espeak_data_dir,
        tmp_id,
    })
}

fn resolve_kokoro_voice() -> String {
    std::env::var("HANDHOLD_TTS_VOICE").unwrap_or_else(|_| DEFAULT_KOKORO_VOICE.to_string())
}

pub(super) fn synthesize_sentence(
    ctx: &KokoContext,
    sentence: &str,
    sentence_idx: usize,
) -> Result<CachedSentence, String> {
    let primary = resolve_kokoro_voice();
    match synthesize_sentence_with_voice(ctx, sentence, sentence_idx, &primary) {
        Ok(result) => Ok(result),
        Err(primary_err) => {
            if primary == FALLBACK_KOKORO_VOICE {
                return Err(primary_err);
            }
            synthesize_sentence_with_voice(
                ctx,
                sentence,
                sentence_idx,
                FALLBACK_KOKORO_VOICE,
            )
            .map_err(|fallback_err| {
                format!(
                    "koko failed for voice \"{primary}\": {primary_err}. Fallback \"{FALLBACK_KOKORO_VOICE}\" also failed: {fallback_err}"
                )
            })
        }
    }
}

fn synthesize_sentence_with_voice(
    ctx: &KokoContext,
    sentence: &str,
    sentence_idx: usize,
    voice: &str,
) -> Result<CachedSentence, String> {
    let tmp_wav =
        std::env::temp_dir().join(format!("handhold_tts_{}_{}.wav", ctx.tmp_id, sentence_idx));
    let tmp_tsv =
        std::env::temp_dir().join(format!("handhold_tts_{}_{}.tsv", ctx.tmp_id, sentence_idx));
    let wav_str = tmp_wav.to_string_lossy().to_string();

    let mut cmd = Command::new(&ctx.koko_bin);
    if let Some(dir) = ctx.espeak_data_dir.as_deref() {
        cmd.env("ESPEAK_DATA_PATH", dir);
    }
    let output = cmd
        .args([
            "-m",
            &ctx.model_path.to_string_lossy(),
            "-d",
            &ctx.voices_path.to_string_lossy(),
            "-s",
            voice,
            "--timestamps",
            "--mono",
            "text",
            sentence,
            "-o",
            &wav_str,
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run koko: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let _ = std::fs::remove_file(&tmp_wav);
        let _ = std::fs::remove_file(&tmp_tsv);
        return Err(format!(
            "koko failed (exit {}): {stderr} {stdout}",
            output.status
        ));
    }

    let wav_bytes =
        std::fs::read(&tmp_wav).map_err(|e| format!("Failed to read koko output: {e}"))?;

    let tsv_content = if tmp_tsv.exists() {
        std::fs::read_to_string(&tmp_tsv).unwrap_or_default()
    } else {
        String::new()
    };

    let _ = std::fs::remove_file(&tmp_wav);
    let _ = std::fs::remove_file(&tmp_tsv);

    if wav_bytes.is_empty() {
        return Err("koko produced no audio output".to_string());
    }

    let (pcm, sample_rate) = wav_to_int16_pcm(&wav_bytes)?;

    Ok(CachedSentence {
        pcm,
        sample_rate,
        tsv_content,
    })
}

pub(super) type SynthResult<'a> = (Vec<(usize, &'a str)>, Vec<(usize, CachedSentence)>);

pub(super) fn synthesize_all_sentences(text: &str) -> Result<SynthResult<'_>, String> {
    let sentences = split_sentences(text);
    let mut koko: Option<KokoContext> = None;

    let mut results: Vec<(usize, CachedSentence)> = Vec::new();
    for (idx, &(char_start, sentence_text)) in sentences.iter().enumerate() {
        let hash = hash_text(sentence_text);

        let cached = match cache_hit(hash) {
            Some(c) => c,
            None => {
                let ctx = match &koko {
                    Some(k) => k,
                    None => {
                        koko = Some(resolve_koko_context()?);
                        koko.as_ref().unwrap()
                    }
                };
                let result = synthesize_sentence(ctx, sentence_text, idx)?;
                cache_write(hash, &result.pcm, result.sample_rate, &result.tsv_content);
                result
            }
        };

        results.push((char_start, cached));
    }

    Ok((sentences, results))
}
