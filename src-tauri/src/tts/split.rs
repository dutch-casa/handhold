pub(super) fn split_sentences(text: &str) -> Vec<(usize, &str)> {
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
