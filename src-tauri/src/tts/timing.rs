use super::cache::CachedSentence;

pub(super) struct InputWord {
    pub index: usize,
    pub char_offset: usize,
}

pub(super) fn extract_input_words(text: &str) -> Vec<InputWord> {
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

pub(super) fn parse_tsv_words(tsv_content: &str) -> Vec<(String, f64, f64)> {
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

pub(super) fn text_word_at(text: &str, offset: usize) -> String {
    text[offset..]
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_string()
}

pub(super) struct StitchedResult {
    pub pcm: Vec<u8>,
    pub sample_rate: u32,
    pub timings: Vec<(usize, usize, f64, f64)>,
    pub duration_ms: f64,
}

pub(super) fn stitch_sentences(
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
