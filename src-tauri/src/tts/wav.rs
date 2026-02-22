const WAV_FORMAT_PCM: u16 = 1;
const WAV_CHANNELS_MONO: u16 = 1;
const WAV_BITS_PER_SAMPLE: u16 = 16;
const WAV_BLOCK_ALIGN: u16 = (WAV_BITS_PER_SAMPLE / 8) * WAV_CHANNELS_MONO;
const WAV_FMT_CHUNK_SIZE: u32 = 16;
const WAV_HEADER_LEN: usize = 44;

pub(super) fn wav_wrap(pcm: &[u8], sample_rate: u32) -> Vec<u8> {
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

pub(super) fn wav_to_int16_pcm(wav_bytes: &[u8]) -> Result<(Vec<u8>, u32), String> {
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

pub(super) fn parse_wav_chunks(wav_bytes: &[u8]) -> Result<(u16, usize, u32, u16, &[u8]), String> {
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
