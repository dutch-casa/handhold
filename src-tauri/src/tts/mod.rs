mod bundle;
mod cache;
mod commands;
mod paths;
mod split;
mod synth;
mod timing;
mod wav;

use serde::Serialize;

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

pub use commands::*;
