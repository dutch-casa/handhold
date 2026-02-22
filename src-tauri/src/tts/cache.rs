use sha2::{Digest, Sha256};

use super::paths::cache_dir;

pub(super) struct CachedSentence {
    pub pcm: Vec<u8>,
    pub sample_rate: u32,
    pub tsv_content: String,
}

/// Deterministic hash for sentence cache keys.
/// Uses SHA-256 truncated to u64 — stable across Rust toolchain versions
/// unlike DefaultHasher.
pub(super) fn hash_text(text: &str) -> u64 {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    let hash = hasher.finalize();
    u64::from_le_bytes([
        hash[0], hash[1], hash[2], hash[3], hash[4], hash[5], hash[6], hash[7],
    ])
}

pub(super) fn cache_hit(hash: u64) -> Option<CachedSentence> {
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

pub(super) fn cache_write(hash: u64, pcm: &[u8], sample_rate: u32, tsv_content: &str) {
    let dir = cache_dir();
    let _ = std::fs::create_dir_all(&dir);

    let pcm_path = dir.join(format!("{hash:016x}.pcm"));
    let meta_path = dir.join(format!("{hash:016x}.meta"));
    let tsv_path = dir.join(format!("{hash:016x}.tsv"));

    let _ = std::fs::write(&pcm_path, pcm);
    let _ = std::fs::write(&meta_path, sample_rate.to_string());
    let _ = std::fs::write(&tsv_path, tsv_content);
}
