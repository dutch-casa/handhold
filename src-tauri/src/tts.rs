use base64::Engine;
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::ipc::Channel;

/// Events streamed to the frontend during and after synthesis.
/// Interface contract: WordBoundary events arrive first, then exactly one AudioReady.
/// Audio data is base64-encoded WAV (16-bit PCM, 24000 Hz, mono).
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum TTSEvent {
    #[serde(rename_all = "camelCase")]
    WordBoundary {
        word: String,
        word_index: usize,
        char_offset: usize,
        start_ms: f64,
        end_ms: f64,
    },
    #[serde(rename_all = "camelCase")]
    AudioReady {
        audio_base64: String,
        duration_ms: f64,
    },
}

// ── Path resolution ──────────────────────────────────────────────────

fn resolve_koko_binary() -> Result<PathBuf, String> {
    let target_triple = env!("TARGET");
    let exe_suffix = if cfg!(windows) { ".exe" } else { "" };

    let mut searched: Vec<PathBuf> = Vec::new();

    // Dev: src-tauri/binaries/koko-{triple}[.exe]
    let dev_candidate = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(format!("koko-{target_triple}{exe_suffix}"));
    searched.push(dev_candidate.clone());
    if dev_candidate.exists() {
        return Ok(dev_candidate);
    }

    // Production: Tauri places sidecars next to the main exe with target triple suffix
    if let Ok(exe) = std::env::current_exe() {
        let dir = exe.parent().unwrap_or(Path::new("."));
        for name in [
            format!("koko-{target_triple}{exe_suffix}"),
            format!("koko{exe_suffix}"),
        ] {
            let candidate = dir.join(&name);
            searched.push(candidate.clone());
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    let searched_list = searched
        .iter()
        .map(|p| p.to_string_lossy())
        .collect::<Vec<_>>()
        .join(", ");

    Err(format!(
        "koko binary not found (target: {target_triple}). Searched: {searched_list}. \
        Run scripts/download-sidecars.sh for this target before building."
    ))
}

/// Directory for ONNX model + voices file.
/// Resolution order:
///   1. Dev: src-tauri/resources/models/ (preferred) or resources/piper/ (legacy)
///   2. Bundled: Tauri resource dir (models shipped inside .app/.deb/.msi)
///   3. Fallback: app data dir (koko auto-downloads missing files on first use)
fn models_dir_has_required_files(dir: &Path) -> bool {
    dir.join("kokoro-v1.0.onnx").is_file() && dir.join("voices-v1.0.bin").is_file()
}

fn resolve_models_dir() -> Result<PathBuf, String> {
    // Dev: prefer the same directory that gets bundled.
    let dev_models = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/models");
    if models_dir_has_required_files(&dev_models) {
        return Ok(dev_models);
    }

    // Legacy dev location (older piper layout)
    let dev_legacy = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/piper");
    if models_dir_has_required_files(&dev_legacy) {
        return Ok(dev_legacy);
    }

    // Bundled: Tauri places resources relative to the executable.
    // macOS: Contents/Resources/resources/models/
    // Linux/Windows: next to exe in resources/models/
    if let Ok(exe) = std::env::current_exe() {
        let exe_dir = exe.parent().unwrap_or(Path::new("."));

        // macOS .app bundle: exe is in Contents/MacOS, resources in Contents/Resources
        let macos_candidate = exe_dir
            .parent()
            .unwrap_or(exe_dir)
            .join("Resources/resources/models");
        if models_dir_has_required_files(&macos_candidate) {
            return Ok(macos_candidate);
        }

        // Linux/Windows: resources dir next to exe
        let flat_candidate = exe_dir.join("resources/models");
        if models_dir_has_required_files(&flat_candidate) {
            return Ok(flat_candidate);
        }
    }

    // Fallback: app data dir — koko auto-downloads missing files on first use
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("handhold/models");
    std::fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create models dir: {e}"))?;
    Ok(app_dir)
}

fn cache_dir() -> PathBuf {
    dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("handhold/tts")
}

fn resolve_espeak_data_dir() -> Option<PathBuf> {
    // Dev: bundled alongside the kokoro resources checkout.
    let dev_candidate =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/piper/espeak-ng-data");
    if dev_candidate.is_dir() {
        return Some(dev_candidate);
    }

    if let Ok(exe) = std::env::current_exe() {
        let exe_dir = exe.parent().unwrap_or(Path::new("."));

        // macOS .app bundle
        let macos_candidate = exe_dir
            .parent()
            .unwrap_or(exe_dir)
            .join("Resources/resources/piper/espeak-ng-data");
        if macos_candidate.is_dir() {
            return Some(macos_candidate);
        }

        // Linux/Windows flat resources
        let flat_candidate = exe_dir.join("resources/piper/espeak-ng-data");
        if flat_candidate.is_dir() {
            return Some(flat_candidate);
        }
    }

    None
}

// ── WAV / PCM utilities ──────────────────────────────────────────────

// WAV header constants — RIFF/WAVE spec for mono 16-bit PCM
const WAV_FORMAT_PCM: u16 = 1;
const WAV_CHANNELS_MONO: u16 = 1;
const WAV_BITS_PER_SAMPLE: u16 = 16;
const WAV_BLOCK_ALIGN: u16 = (WAV_BITS_PER_SAMPLE / 8) * WAV_CHANNELS_MONO;
const WAV_FMT_CHUNK_SIZE: u32 = 16;
const WAV_HEADER_LEN: usize = 44;

fn wav_wrap(pcm: &[u8], sample_rate: u32) -> Vec<u8> {
    let data_len = pcm.len() as u32;
    let file_len = (WAV_HEADER_LEN as u32 - 8) + data_len;
    let byte_rate = sample_rate * WAV_BLOCK_ALIGN as u32;
    let mut out = Vec::with_capacity(WAV_HEADER_LEN + pcm.len());

    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&file_len.to_le_bytes());
    out.extend_from_slice(b"WAVE");
    out.extend_from_slice(b"fmt ");
    out.extend_from_slice(&WAV_FMT_CHUNK_SIZE.to_le_bytes());
    out.extend_from_slice(&WAV_FORMAT_PCM.to_le_bytes());
    out.extend_from_slice(&WAV_CHANNELS_MONO.to_le_bytes());
    out.extend_from_slice(&sample_rate.to_le_bytes());
    out.extend_from_slice(&byte_rate.to_le_bytes());
    out.extend_from_slice(&WAV_BLOCK_ALIGN.to_le_bytes());
    out.extend_from_slice(&WAV_BITS_PER_SAMPLE.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    out.extend_from_slice(pcm);

    out
}

/// Decode WAV → mono int16 PCM.
/// Supports PCM 16-bit and IEEE float 32-bit (including WAVE_FORMAT_EXTENSIBLE).
fn wav_to_int16_pcm(wav_bytes: &[u8]) -> Result<(Vec<u8>, u32), String> {
    let (format, num_channels, sample_rate, bits_per_sample, data) = parse_wav_chunks(wav_bytes)?;

    match (format, bits_per_sample) {
        (1, 16) => pcm16_to_mono(data, num_channels, sample_rate),
        (3, 32) => float32_to_mono(data, num_channels, sample_rate),
        (0xFFFE, 16) => pcm16_to_mono(data, num_channels, sample_rate),
        (0xFFFE, 32) => float32_to_mono(data, num_channels, sample_rate),
        _ => Err(format!(
            "Unsupported WAV format: format={format} bits={bits_per_sample}"
        )),
    }
}

fn parse_wav_chunks(wav_bytes: &[u8]) -> Result<(u16, usize, u32, u16, &[u8]), String> {
    if wav_bytes.len() < 12 {
        return Err("WAV too short to contain RIFF header".into());
    }
    if &wav_bytes[0..4] != b"RIFF" || &wav_bytes[8..12] != b"WAVE" {
        return Err("Invalid RIFF/WAVE header".into());
    }

    let mut offset = 12;
    let mut format: Option<u16> = None;
    let mut num_channels: Option<usize> = None;
    let mut sample_rate: Option<u32> = None;
    let mut bits_per_sample: Option<u16> = None;
    let mut data_chunk: Option<&[u8]> = None;

    while offset + 8 <= wav_bytes.len() {
        let chunk_id = &wav_bytes[offset..offset + 4];
        let chunk_size = u32::from_le_bytes([
            wav_bytes[offset + 4],
            wav_bytes[offset + 5],
            wav_bytes[offset + 6],
            wav_bytes[offset + 7],
        ]) as usize;
        let chunk_start = offset + 8;
        let chunk_end = (chunk_start + chunk_size).min(wav_bytes.len());

        if chunk_id == b"fmt " {
            if chunk_size < 16 || chunk_end < chunk_start + 16 {
                return Err("WAV fmt chunk too small".into());
            }
            format = Some(u16::from_le_bytes([
                wav_bytes[chunk_start],
                wav_bytes[chunk_start + 1],
            ]));
            num_channels =
                Some(
                    u16::from_le_bytes([wav_bytes[chunk_start + 2], wav_bytes[chunk_start + 3]])
                        as usize,
                );
            sample_rate = Some(u32::from_le_bytes([
                wav_bytes[chunk_start + 4],
                wav_bytes[chunk_start + 5],
                wav_bytes[chunk_start + 6],
                wav_bytes[chunk_start + 7],
            ]));
            bits_per_sample = Some(u16::from_le_bytes([
                wav_bytes[chunk_start + 14],
                wav_bytes[chunk_start + 15],
            ]));
        } else if chunk_id == b"data" {
            data_chunk = Some(&wav_bytes[chunk_start..chunk_end]);
        }

        // Chunks are word-aligned (pad to even).
        offset = chunk_end + (chunk_size % 2);
    }

    let format = format.ok_or("Missing WAV fmt chunk")?;
    let num_channels = num_channels.ok_or("Missing WAV channel count")?;
    let sample_rate = sample_rate.ok_or("Missing WAV sample rate")?;
    let bits_per_sample = bits_per_sample.ok_or("Missing WAV bits per sample")?;
    let data = data_chunk.ok_or("Missing WAV data chunk")?;

    if num_channels == 0 {
        return Err("WAV has zero channels".into());
    }

    Ok((format, num_channels, sample_rate, bits_per_sample, data))
}

fn pcm16_to_mono(
    data: &[u8],
    num_channels: usize,
    sample_rate: u32,
) -> Result<(Vec<u8>, u32), String> {
    let frame_bytes = num_channels * 2;
    if data.len() < frame_bytes {
        return Err("WAV data chunk too small".into());
    }
    let mut pcm = Vec::with_capacity(data.len() / num_channels);
    for frame in data.chunks_exact(frame_bytes) {
        let mut sum = 0i32;
        for ch in 0..num_channels {
            let off = ch * 2;
            let sample = i16::from_le_bytes([frame[off], frame[off + 1]]) as i32;
            sum += sample;
        }
        let mono = (sum / num_channels as i32) as i16;
        pcm.extend_from_slice(&mono.to_le_bytes());
    }
    Ok((pcm, sample_rate))
}

fn float32_to_mono(
    data: &[u8],
    num_channels: usize,
    sample_rate: u32,
) -> Result<(Vec<u8>, u32), String> {
    let frame_bytes = num_channels * 4;
    if data.len() < frame_bytes {
        return Err("WAV data chunk too small".into());
    }
    let num_frames = data.len() / frame_bytes;
    let mut pcm = Vec::with_capacity(num_frames * 2);

    for frame in data.chunks_exact(frame_bytes) {
        let mut sum = 0.0f32;
        for ch in 0..num_channels {
            let off = ch * 4;
            sum += f32::from_le_bytes([frame[off], frame[off + 1], frame[off + 2], frame[off + 3]]);
        }
        let mono = (sum / num_channels as f32).clamp(-1.0, 1.0);
        let int_val = (mono * 32767.0) as i16;
        pcm.extend_from_slice(&int_val.to_le_bytes());
    }

    Ok((pcm, sample_rate))
}

// ── Sentence splitting ───────────────────────────────────────────────

/// Split narration into sentences for per-sentence TTS caching.
/// Boundaries: `.` `!` `?` followed by whitespace or end-of-text (handles "..." and "?!" too).
/// Returns (char_offset, slice) pairs — offsets let us map TSV word timings back to the full text.
fn split_sentences(text: &str) -> Vec<(usize, &str)> {
    let mut sentences = Vec::new();
    let mut start = 0;

    let bytes = text.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        let b = bytes[i];
        if b == b'.' || b == b'!' || b == b'?' {
            while i + 1 < len
                && (bytes[i + 1] == b'.' || bytes[i + 1] == b'!' || bytes[i + 1] == b'?')
            {
                i += 1;
            }
            if i + 1 >= len || bytes[i + 1].is_ascii_whitespace() {
                let end = i + 1;
                let raw = &text[start..end];
                let trimmed = raw.trim();
                if !trimmed.is_empty() {
                    let leading = raw.len() - raw.trim_start().len();
                    sentences.push((start + leading, trimmed));
                }
                i += 1;
                while i < len && bytes[i].is_ascii_whitespace() {
                    i += 1;
                }
                start = i;
                continue;
            }
        }
        i += 1;
    }

    let raw_tail = &text[start..];
    let trimmed = raw_tail.trim();
    if !trimmed.is_empty() {
        let leading = raw_tail.len() - raw_tail.trim_start().len();
        sentences.push((start + leading, trimmed));
    }

    sentences
}

fn hash_text(text: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    hasher.finish()
}

// ── Cache I/O ────────────────────────────────────────────────────────

/// Cached sentence: int16 mono PCM bytes + TSV content string.
struct CachedSentence {
    pcm: Vec<u8>,
    sample_rate: u32,
    tsv_content: String,
}

fn cache_hit(hash: u64) -> Option<CachedSentence> {
    let dir = cache_dir();
    let pcm_path = dir.join(format!("{hash:016x}.pcm"));
    let meta_path = dir.join(format!("{hash:016x}.meta"));
    let tsv_path = dir.join(format!("{hash:016x}.tsv"));

    let pcm = std::fs::read(&pcm_path).ok()?;
    let meta = std::fs::read_to_string(&meta_path).ok()?;
    let sample_rate: u32 = meta.trim().parse().ok()?;
    let tsv_content = std::fs::read_to_string(&tsv_path).unwrap_or_default();

    Some(CachedSentence {
        pcm,
        sample_rate,
        tsv_content,
    })
}

fn cache_write(hash: u64, pcm: &[u8], sample_rate: u32, tsv_content: &str) {
    let dir = cache_dir();
    let _ = std::fs::create_dir_all(&dir);

    let pcm_path = dir.join(format!("{hash:016x}.pcm"));
    let meta_path = dir.join(format!("{hash:016x}.meta"));
    let tsv_path = dir.join(format!("{hash:016x}.tsv"));

    let _ = std::fs::write(&pcm_path, pcm);
    let _ = std::fs::write(&meta_path, sample_rate.to_string());
    let _ = std::fs::write(&tsv_path, tsv_content);
}

// ── Per-sentence synthesis ───────────────────────────────────────────

const DEFAULT_KOKORO_VOICE: &str = "am_michael";
const FALLBACK_KOKORO_VOICE: &str = "bf_emma";

/// Synthesize a single sentence via koko. Returns int16 PCM + TSV content.
/// koko auto-downloads the ONNX model and voices file on first use if missing.
fn synthesize_sentence(
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

fn resolve_kokoro_voice() -> String {
    std::env::var("HANDHOLD_TTS_VOICE").unwrap_or_else(|_| DEFAULT_KOKORO_VOICE.to_string())
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

// ── TSV parsing ──────────────────────────────────────────────────────

/// Word timing from a TSV: (word_text, start_sec, end_sec)
fn parse_tsv_words(tsv_content: &str) -> Vec<(String, f64, f64)> {
    let mut words = Vec::new();
    for line in tsv_content.lines().skip(1) {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 3 {
            continue;
        }
        let word = cols[0];
        if word.chars().all(|c| c.is_ascii_punctuation()) {
            continue;
        }
        let start: f64 = cols[1].parse().unwrap_or(0.0);
        let end: f64 = cols[2].parse().unwrap_or(0.0);
        words.push((word.to_string(), start, end));
    }
    words
}

// ── Word extraction ──────────────────────────────────────────────────

struct InputWord {
    index: usize,
    char_offset: usize,
}

fn extract_input_words(text: &str) -> Vec<InputWord> {
    let mut words = Vec::new();
    let mut index = 0;
    let mut chars = text.char_indices().peekable();

    while chars.peek().is_some() {
        while chars.peek().is_some_and(|&(_, c)| c.is_whitespace()) {
            chars.next();
        }

        let Some(&(word_start, _)) = chars.peek() else {
            break;
        };

        let mut word_end = word_start;
        while chars.peek().is_some_and(|&(_, c)| !c.is_whitespace()) {
            let (i, c) = chars.next().unwrap();
            word_end = i + c.len_utf8();
        }

        if word_end > word_start {
            words.push(InputWord {
                index,
                char_offset: word_start,
            });
            index += 1;
        }
    }

    words
}

fn text_word_at(text: &str, offset: usize) -> String {
    text[offset..]
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_string()
}

// ── Bundle I/O ───────────────────────────────────────────────────────

/// Bundled step audio: WAV file + timings file, keyed by full-text hash.
/// Layout: {bundle_dir}/{hash:016x}.wav, {bundle_dir}/{hash:016x}.timings
/// Timings format: one line per word → word_index\tchar_offset\tstart_ms\tend_ms
struct BundledAudio {
    wav_bytes: Vec<u8>,
    timings: Vec<(usize, usize, f64, f64)>, // (word_index, char_offset, start_ms, end_ms)
    duration_ms: f64,
}

fn bundle_hit(bundle_path: &Path, text_hash: u64) -> Option<BundledAudio> {
    let wav_path = bundle_path.join(format!("{text_hash:016x}.wav"));
    let timings_path = bundle_path.join(format!("{text_hash:016x}.timings"));

    let wav_bytes = std::fs::read(&wav_path).ok()?;
    let timings_str = std::fs::read_to_string(&timings_path).ok()?;

    let mut timings = Vec::new();
    for line in timings_str.lines() {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 4 {
            continue;
        }
        let word_index: usize = cols[0].parse().ok()?;
        let char_offset: usize = cols[1].parse().ok()?;
        let start_ms: f64 = cols[2].parse().ok()?;
        let end_ms: f64 = cols[3].parse().ok()?;
        timings.push((word_index, char_offset, start_ms, end_ms));
    }

    // Duration from WAV header: data_size / (sample_rate * channels * bytes_per_sample)
    let sample_rate = if wav_bytes.len() >= 28 {
        u32::from_le_bytes([wav_bytes[24], wav_bytes[25], wav_bytes[26], wav_bytes[27]]) as f64
    } else {
        24000.0
    };
    let data_pos = wav_bytes.windows(4).position(|w| w == b"data")?;
    let data_size = if wav_bytes.len() >= data_pos + 8 {
        u32::from_le_bytes([
            wav_bytes[data_pos + 4],
            wav_bytes[data_pos + 5],
            wav_bytes[data_pos + 6],
            wav_bytes[data_pos + 7],
        ]) as f64
    } else {
        return None;
    };
    // int16 mono: 2 bytes per sample
    let duration_ms = (data_size / 2.0 / sample_rate) * 1000.0;

    Some(BundledAudio {
        wav_bytes,
        timings,
        duration_ms,
    })
}

fn bundle_write(
    bundle_path: &Path,
    text_hash: u64,
    wav: &[u8],
    timings: &[(usize, usize, f64, f64)],
) {
    let _ = std::fs::create_dir_all(bundle_path);
    let wav_path = bundle_path.join(format!("{text_hash:016x}.wav"));
    let timings_path = bundle_path.join(format!("{text_hash:016x}.timings"));

    let _ = std::fs::write(&wav_path, wav);

    let mut content = String::new();
    for &(wi, co, start, end) in timings {
        content.push_str(&format!("{wi}\t{co}\t{start}\t{end}\n"));
    }
    let _ = std::fs::write(&timings_path, &content);
}

// ── Stitching (shared by synthesize + export) ────────────────────────

struct StitchedResult {
    pcm: Vec<u8>,
    sample_rate: u32,
    timings: Vec<(usize, usize, f64, f64)>,
    duration_ms: f64,
}

/// Stitch per-sentence cached results into a single PCM buffer + global word timings.
fn stitch_sentences(
    text: &str,
    sentences: &[(usize, &str)],
    sentence_results: &[(usize, CachedSentence)],
) -> Result<StitchedResult, String> {
    let input_words = extract_input_words(text);
    let sample_rate = sentence_results
        .first()
        .map(|(_, c)| c.sample_rate)
        .unwrap_or(24000);

    let mut combined_pcm: Vec<u8> = Vec::new();
    let mut all_timings: Vec<(usize, usize, f64, f64)> = Vec::new();
    let mut time_offset_ms: f64 = 0.0;

    for (sentence_char_start, cached) in sentence_results {
        let sentence_duration_ms =
            (cached.pcm.len() as f64 / 2.0 / cached.sample_rate as f64) * 1000.0;

        let tsv_words = parse_tsv_words(&cached.tsv_content);

        let sentence_byte_end = sentences
            .iter()
            .find(|&&(start, _)| start == *sentence_char_start)
            .map(|&(start, s)| start + s.len())
            .unwrap_or(text.len());

        let sentence_input_words: Vec<&InputWord> = input_words
            .iter()
            .filter(|iw| {
                iw.char_offset >= *sentence_char_start && iw.char_offset < sentence_byte_end
            })
            .collect();

        if !tsv_words.is_empty() {
            for (tsv_idx, iw) in sentence_input_words.iter().enumerate() {
                if tsv_idx >= tsv_words.len() {
                    break;
                }
                let (_, start_sec, end_sec) = &tsv_words[tsv_idx];
                let start_ms = start_sec * 1000.0 + time_offset_ms;
                let end_ms = end_sec * 1000.0 + time_offset_ms;
                all_timings.push((iw.index, iw.char_offset, start_ms, end_ms));
            }
        } else {
            let word_count = sentence_input_words.len().max(1) as f64;
            for (i, iw) in sentence_input_words.iter().enumerate() {
                let start_ms = (i as f64 / word_count) * sentence_duration_ms + time_offset_ms;
                let end_ms =
                    ((i as f64 + 1.0) / word_count) * sentence_duration_ms + time_offset_ms;
                all_timings.push((iw.index, iw.char_offset, start_ms, end_ms));
            }
        }

        combined_pcm.extend_from_slice(&cached.pcm);
        time_offset_ms += sentence_duration_ms;
    }

    if combined_pcm.is_empty() {
        return Err("No audio produced for any sentence".to_string());
    }

    Ok(StitchedResult {
        pcm: combined_pcm,
        sample_rate,
        timings: all_timings,
        duration_ms: time_offset_ms,
    })
}

// ── Sentence synthesis pipeline (shared) ─────────────────────────────

type SynthResult<'a> = (Vec<(usize, &'a str)>, Vec<(usize, CachedSentence)>);

/// Resolved lazily on first cache miss — avoids failing when koko isn't installed
/// but all sentences are already cached.
struct KokoContext {
    koko_bin: PathBuf,
    model_path: PathBuf,
    voices_path: PathBuf,
    espeak_data_dir: Option<PathBuf>,
    tmp_id: u128,
}

fn resolve_koko_context() -> Result<KokoContext, String> {
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

fn synthesize_all_sentences(text: &str) -> Result<SynthResult<'_>, String> {
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

// ── Warm-up command ──────────────────────────────────────────────────

/// Pre-download TTS models on app startup so the first synthesis is fast.
/// Runs koko with a trivial input — koko auto-downloads missing model files.
#[tauri::command]
pub async fn ensure_tts_ready() -> Result<String, String> {
    let koko_bin = resolve_koko_binary()?;
    let models_dir = resolve_models_dir()?;
    let model_path = models_dir.join("kokoro-v1.0.onnx");
    let voices_path = models_dir.join("voices-v1.0.bin");
    let espeak_data_dir = resolve_espeak_data_dir();

    // Already downloaded — skip
    if model_path.exists() && voices_path.exists() {
        return Ok("ready".to_string());
    }

    // Run koko with a tiny sentence to trigger the auto-download
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

// ── Main command ─────────────────────────────────────────────────────

/// Synthesize text to audio via Kokoro TTS.
/// Resolution order: bundle → sentence cache → koko.
#[tauri::command]
pub async fn synthesize(
    _app: tauri::AppHandle,
    text: String,
    bundle_path: Option<String>,
    on_event: Channel<TTSEvent>,
) -> Result<(), String> {
    let text_hash = hash_text(&text);

    // 1. Check bundle (pre-exported audio shipped with the course)
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

    // 2. Per-sentence synthesis (sentence cache → koko for misses)
    let (sentences, sentence_results) = synthesize_all_sentences(&text)?;
    let stitched = stitch_sentences(&text, &sentences, &sentence_results)?;

    // Emit word boundaries
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

// ── Export command ────────────────────────────────────────────────────

/// Batch-export audio for all given texts into a bundle directory.
/// Idempotent: skips texts that already have a bundle file.
#[tauri::command]
pub async fn export_audio(texts: Vec<String>, bundle_dir: String) -> Result<usize, String> {
    let bp = Path::new(&bundle_dir);
    let _ = std::fs::create_dir_all(bp);

    let mut exported = 0usize;
    for text in &texts {
        let text_hash = hash_text(text.as_str());

        // Skip if already exported
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
