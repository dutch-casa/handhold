use std::path::Path;

use super::wav::parse_wav_chunks;

pub(super) struct BundledAudio {
    pub wav_bytes: Vec<u8>,
    pub timings: Vec<(usize, usize, f64, f64)>,
    pub duration_ms: f64,
}

pub(super) fn bundle_hit(bundle_path: &Path, text_hash: u64) -> Option<BundledAudio> {
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

    let (_, _, sample_rate, _, data) = parse_wav_chunks(&wav_bytes).ok()?;
    let duration_ms = (data.len() as f64 / 2.0 / sample_rate as f64) * 1000.0;

    Some(BundledAudio {
        wav_bytes,
        timings,
        duration_ms,
    })
}

pub(super) fn bundle_write(
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
