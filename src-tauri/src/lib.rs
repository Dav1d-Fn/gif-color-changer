use base64::{engine::general_purpose, Engine as _};
use color_quant::NeuQuant;
use gif::{ColorOutput, DecodeOptions, DisposalMethod, Encoder as GifEncoder, Repeat};
use rayon::prelude::*;
use std::borrow::Cow;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::ipc::Channel;

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorMapping {
    pub target_r: u8,
    pub target_g: u8,
    pub target_b: u8,
    pub repl_r: u8,
    pub repl_g: u8,
    pub repl_b: u8,
    pub transparent: bool,
    pub tolerance: u32,
    pub border_pct: f32,
    pub unmatte: bool,
}

fn estimate_alpha(r: u8, g: u8, b: u8, mr: u8, mg: u8, mb: u8) -> f32 {
    let mut max_a: f32 = 0.0;
    for (p, m) in [(r as f32, mr as f32), (g as f32, mg as f32), (b as f32, mb as f32)] {
        let far = if m >= 128.0 { 0.0 } else { 255.0 };
        let range = (m - far).abs();
        if range > 1.0 {
            let a = (m - p).abs() / range;
            if a > max_a { max_a = a; }
        }
    }
    max_a.clamp(0.0, 1.0)
}

fn unmatte_channel(p: u8, m: u8, alpha: f32) -> u8 {
    ((p as f32 - (1.0 - alpha) * m as f32) / alpha)
        .clamp(0.0, 255.0)
        .round() as u8
}

fn replace_pixel(pixel: &mut [u8], m: &ColorMapping) {
    if m.transparent {
        pixel[3] = 0;
    } else {
        pixel[0] = m.repl_r;
        pixel[1] = m.repl_g;
        pixel[2] = m.repl_b;
    }
}

// Applies all mappings to a frame.
// Pre-pass:  unmatte rules recover pixel colors from the baked-in background matte and mark
//            pure-background pixels for later removal.
// Main pass: regular transparent + color rules run on the (possibly recovered) colors.
// Post-pass: background-marked pixels that no rule matched are made transparent.
// If any mapping has border_pct > 0, a final border-expansion pass runs after all of the above.
fn transform_frame(rgba: &mut Vec<u8>, width: usize, height: usize, mappings: &[ColorMapping]) {
    let n = width * height;
    let base = width.min(height) as f32;

    // Pre-pass – unmatte: recover colors blended with the matte; mark pure-background pixels.
    let mut is_background = vec![false; n];
    for m in mappings.iter().filter(|m| m.transparent && m.unmatte) {
        let threshold = m.tolerance as f32 / 100.0;
        for (i, pixel) in rgba.chunks_mut(4).enumerate() {
            if pixel[3] == 0 { continue; }
            let (r, g, b) = (pixel[0], pixel[1], pixel[2]);
            let alpha = estimate_alpha(r, g, b, m.target_r, m.target_g, m.target_b);
            if alpha < threshold {
                is_background[i] = true;
            } else if alpha < 0.99 {
                pixel[0] = unmatte_channel(r, m.target_r, alpha);
                pixel[1] = unmatte_channel(g, m.target_g, alpha);
                pixel[2] = unmatte_channel(b, m.target_b, alpha);
            }
            // alpha ≈ 1.0: pure color, untouched
        }
    }

    // Build rule order for main pass (unmatte rules excluded — already handled above).
    // Remaining transparent rules first, then color-replacement rules.
    let mut order: Vec<usize> = (0..mappings.len())
        .filter(|&i| !(mappings[i].transparent && mappings[i].unmatte))
        .collect();
    order.sort_by_key(|&i| if mappings[i].transparent { 0usize } else { 1 });

    // Precompute per-mapping border radius in pixels.
    let border_px: Vec<i32> = mappings.iter()
        .map(|m| (m.border_pct / 100.0 * base).round() as i32)
        .collect();
    let max_border = *border_px.iter().max().unwrap_or(&0);

    // Precompute target variants per rule: original target + unmatte-recovered versions.
    // A color target picked from the original (matte-blended) image gets a computed
    // "clean" variant by running the same unmatte math on the target color itself.
    // The main pass checks all variants so both pure and recovered pixels match.
    let unmatte_rules: Vec<&ColorMapping> = mappings.iter()
        .filter(|m| m.transparent && m.unmatte)
        .collect();
    let target_variants: Vec<Vec<(u8, u8, u8)>> = order.iter().map(|&mi| {
        let m = &mappings[mi];
        let mut variants = vec![(m.target_r, m.target_g, m.target_b)];
        for um in &unmatte_rules {
            let threshold = um.tolerance as f32 / 100.0;
            let alpha = estimate_alpha(m.target_r, m.target_g, m.target_b,
                                       um.target_r, um.target_g, um.target_b);
            if alpha >= threshold && alpha < 0.99 {
                variants.push((
                    unmatte_channel(m.target_r, um.target_r, alpha),
                    unmatte_channel(m.target_g, um.target_g, alpha),
                    unmatte_channel(m.target_b, um.target_b, alpha),
                ));
            }
        }
        variants
    }).collect();

    // Main pass – dist_sq matching on recovered colors, checking all target variants.
    let mut applied: Vec<i32> = vec![-1; n];
    for (i, pixel) in rgba.chunks_mut(4).enumerate() {
        if pixel[3] == 0 { continue; }
        let (r, g, b) = (pixel[0], pixel[1], pixel[2]);
        for (oi, &mi) in order.iter().enumerate() {
            let m = &mappings[mi];
            let matched = target_variants[oi].iter().any(|&(tr, tg, tb)| {
                dist_sq(r, g, b, tr, tg, tb) <= m.tolerance * m.tolerance
            });
            if matched {
                replace_pixel(pixel, m);
                applied[i] = mi as i32;
                break;
            }
        }
    }

    // Post-pass – background pixels with no rule match become transparent.
    for (i, pixel) in rgba.chunks_mut(4).enumerate() {
        if is_background[i] && applied[i] == -1 && pixel[3] > 0 {
            pixel[3] = 0;
        }
    }

    if max_border == 0 { return; }

    // Pass 2 – expand each replaced region by its mapping's border radius.
    // For each unmatched opaque pixel, find the nearest matched neighbour whose
    // mapping's border radius reaches it, then apply that mapping.
    for y in 0..height {
        for x in 0..width {
            let i = y * width + x;
            if applied[i] >= 0 || rgba[i * 4 + 3] == 0 { continue; }

            let mut best_mi: i32 = -1;
            let mut best_d = i32::MAX;
            for dy in -max_border..=max_border {
                for dx in -max_border..=max_border {
                    let nx = x as i32 + dx;
                    let ny = y as i32 + dy;
                    if nx < 0 || ny < 0 || nx >= width as i32 || ny >= height as i32 { continue; }
                    let ni = ny as usize * width + nx as usize;
                    let mi = applied[ni];
                    if mi < 0 { continue; }
                    let d = dx * dx + dy * dy;
                    if d <= border_px[mi as usize] * border_px[mi as usize] && d < best_d {
                        best_d = d;
                        best_mi = mi;
                    }
                }
            }

            if best_mi >= 0 {
                replace_pixel(&mut rgba[i * 4..(i + 1) * 4], &mappings[best_mi as usize]);
            }
        }
    }
}

fn dist_sq(r1: u8, g1: u8, b1: u8, r2: u8, g2: u8, b2: u8) -> u32 {
    let dr = r1 as i32 - r2 as i32;
    let dg = g1 as i32 - g2 as i32;
    let db = b1 as i32 - b2 as i32;
    (dr * dr + dg * dg + db * db) as u32
}

struct DecodedGif {
    width: u16,
    height: u16,
    // Each entry is (full-screen RGBA buffer, frame delay in centiseconds).
    // Buffer length is always width * height * 4.
    frames: Vec<(Vec<u8>, u16)>,
}

// Pass 1: fully composite all frames to full-screen RGBA images.
// ColorOutput::RGBA means the gif crate resolves palette + transparency to actual RGBA pixels.
// Transparent pixels have alpha == 0; we only overwrite canvas pixels with opaque frame pixels.
fn decode_to_rgba_frames(file_path: &str) -> Result<DecodedGif, String> {
    let file = std::fs::File::open(file_path).map_err(|e| e.to_string())?;
    let mut options = DecodeOptions::new();
    options.set_color_output(ColorOutput::RGBA);
    let mut decoder = options.read_info(file).map_err(|e| e.to_string())?;

    let width = decoder.width();
    let height = decoder.height();
    let cw = width as usize;
    let ch = height as usize;
    // RGBA canvas: alpha==0 means transparent
    let mut canvas = vec![0u8; cw * ch * 4];
    let mut frames: Vec<(Vec<u8>, u16)> = Vec::new();

    while let Some(frame) = decoder.read_next_frame().map_err(|e| e.to_string())? {
        let pre_canvas = if frame.dispose == DisposalMethod::Previous {
            Some(canvas.clone())
        } else {
            None
        };

        // Composite this frame's bounding-box RGBA pixels onto the full-screen canvas.
        let fw = frame.width as usize;
        let fh = frame.height as usize;
        let fl = frame.left as usize;
        let ft = frame.top as usize;
        for row in 0..fh {
            for col in 0..fw {
                let cr = ft + row;
                let cc = fl + col;
                if cr >= ch || cc >= cw {
                    continue;
                }
                let src = (row * fw + col) * 4;
                if frame.buffer[src + 3] == 0 {
                    continue;
                }
                let dst = (cr * cw + cc) * 4;
                canvas[dst..dst + 4].copy_from_slice(&frame.buffer[src..src + 4]);
            }
        }

        frames.push((canvas.clone(), frame.delay));

        match frame.dispose {
            DisposalMethod::Background => canvas = vec![0u8; cw * ch * 4],
            DisposalMethod::Previous => {
                canvas = pre_canvas.unwrap_or_else(|| vec![0u8; cw * ch * 4]);
            }
            _ => {}
        }
    }

    Ok(DecodedGif { width, height, frames })
}

// Pass 3: encode a list of full-screen RGBA frames back to a GIF (base64 data URI).
fn encode_rgba_frames_to_gif(gif: &DecodedGif) -> Result<String, String> {
    let dummy_pal = [0u8; 12];
    let mut output: Vec<u8> = Vec::new();

    let mut encoder =
        GifEncoder::new(&mut output, gif.width, gif.height, &dummy_pal)
            .map_err(|e| e.to_string())?;
    encoder.set_repeat(Repeat::Infinite).map_err(|e| e.to_string())?;

    for (rgba, delay) in &gif.frames {
        encoder
            .write_frame(&rgba_to_gif_frame(rgba, gif.width, gif.height, *delay))
            .map_err(|e| e.to_string())?;
    }
    drop(encoder);

    Ok(format!(
        "data:image/gif;base64,{}",
        general_purpose::STANDARD.encode(&output)
    ))
}

// Quantizes a full-screen RGBA buffer to an indexed gif::Frame using NeuQuant.
// Transparent pixels (alpha == 0) get their own reserved palette slot.
// Opaque pixels get up to 255 palette entries (or 256 if no transparency).
fn rgba_to_gif_frame(rgba: &[u8], width: u16, height: u16, delay_cs: u16) -> gif::Frame<'static> {
    let n = width as usize * height as usize;
    let has_transparent = rgba.chunks(4).any(|p| p[3] == 0);

    // Reserve one slot for the transparent index if needed
    let n_colors = if has_transparent { 255 } else { 256 };

    // Collect opaque pixels for NeuQuant (needs RGBA input)
    let opaque: Vec<u8> = rgba
        .chunks(4)
        .filter(|p| p[3] > 0)
        .flat_map(|p| p.iter().copied())
        .collect();

    let mut buffer = vec![0u8; n];
    let mut palette;
    let t_idx: Option<u8>;

    if opaque.is_empty() {
        // All-transparent frame
        palette = vec![0u8; 4 * 3];
        t_idx = Some(0);
    } else {
        let nq = NeuQuant::new(10, n_colors, &opaque);
        palette = nq.color_map_rgb();

        let t_slot = palette.len() / 3; // = n_colors (255 or 256)
        for (i, pixel) in rgba.chunks(4).enumerate() {
            if pixel[3] == 0 {
                buffer[i] = t_slot as u8;
            } else {
                buffer[i] = nq.index_of(pixel) as u8;
            }
        }

        if has_transparent {
            palette.extend_from_slice(&[0, 0, 0]);
            t_idx = Some(t_slot as u8);
        } else {
            t_idx = None;
        }
    }

    let count = palette.len() / 3;
    let target = count.next_power_of_two().max(4).min(256);
    palette.resize(target * 3, 0);

    let mut frame = gif::Frame::default();
    frame.width = width;
    frame.height = height;
    frame.buffer = Cow::Owned(buffer);
    frame.transparent = t_idx;
    frame.palette = Some(palette);
    frame.delay = delay_cs;
    frame.dispose = DisposalMethod::Background;
    frame
}

#[derive(serde::Serialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ProgressEvent {
    Decode,
    Transform { frame: usize, total: usize },
    Encode   { frame: usize, total: usize },
}

#[tauri::command]
async fn apply_color_changes(
    file_path: String,
    mappings: Vec<ColorMapping>,
    on_progress: Channel<ProgressEvent>,
) -> Result<String, String> {
    if mappings.is_empty() {
        return Err("No color mappings provided".to_string());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let t = std::time::Instant::now();

        let _ = on_progress.send(ProgressEvent::Decode);
        let mut decoded = decode_to_rgba_frames(&file_path)?;
        let total = decoded.frames.len();
        let width  = decoded.width as usize;
        let height = decoded.height as usize;
        eprintln!("[bench] decode: {}ms  ({} frames)", t.elapsed().as_millis(), total);

        let t2 = std::time::Instant::now();
        let counter = Arc::new(AtomicUsize::new(0));
        decoded.frames.par_iter_mut().for_each(|(rgba, _)| {
            transform_frame(rgba, width, height, &mappings);
            let done = counter.fetch_add(1, Ordering::Relaxed) + 1;
            let _ = on_progress.send(ProgressEvent::Transform { frame: done, total });
        });
        eprintln!("[bench] transform: {}ms", t2.elapsed().as_millis());

        // Pass 3a: parallele NeuQuant-Quantisierung (teuerste Operation)
        let t3 = std::time::Instant::now();
        let enc_counter = Arc::new(AtomicUsize::new(0));
        let gif_frames: Vec<gif::Frame<'static>> = decoded.frames
            .par_iter()
            .map(|(rgba, delay)| {
                let frame = rgba_to_gif_frame(rgba, decoded.width, decoded.height, *delay);
                let done = enc_counter.fetch_add(1, Ordering::Relaxed) + 1;
                let _ = on_progress.send(ProgressEvent::Encode { frame: done, total });
                frame
            })
            .collect();
        eprintln!("[bench] quantize: {}ms", t3.elapsed().as_millis());

        // Pass 3b: sequentielles Schreiben in GifEncoder (nicht Send)
        let t4 = std::time::Instant::now();
        let dummy_pal = [0u8; 12];
        let mut output: Vec<u8> = Vec::new();
        let mut encoder =
            GifEncoder::new(&mut output, decoded.width, decoded.height, &dummy_pal)
                .map_err(|e| e.to_string())?;
        encoder.set_repeat(Repeat::Infinite).map_err(|e| e.to_string())?;
        for frame in gif_frames {
            encoder.write_frame(&frame).map_err(|e| e.to_string())?;
        }
        drop(encoder);
        eprintln!("[bench] gif_write: {}ms | total: {}ms",
            t4.elapsed().as_millis(), t.elapsed().as_millis());

        Ok(format!(
            "data:image/gif;base64,{}",
            general_purpose::STANDARD.encode(&output)
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn apply_frame(
    file_path: String,
    frame_index: usize,
    mappings: Vec<ColorMapping>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let t = std::time::Instant::now();
        let decoded = decode_to_rgba_frames(&file_path)?;
        let width  = decoded.width as usize;
        let height = decoded.height as usize;

        let (rgba, delay) = decoded.frames
            .get(frame_index)
            .ok_or_else(|| format!("Frame {} out of range (total: {})", frame_index, decoded.frames.len()))?;

        let mut rgba = rgba.clone();
        transform_frame(&mut rgba, width, height, &mappings);

        let single = DecodedGif { width: decoded.width, height: decoded.height, frames: vec![(rgba, *delay)] };
        let result = encode_rgba_frames_to_gif(&single);
        eprintln!("[bench] apply_frame({}) total: {}ms", frame_index, t.elapsed().as_millis());
        result
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn preview_affected(
    file_path: String,
    target_r: u8,
    target_g: u8,
    target_b: u8,
    tolerance: u32,
) -> Result<String, String> {
    let t = std::time::Instant::now();
    let tol_sq = tolerance * tolerance;

    // Pass 1: decode
    let mut decoded = decode_to_rgba_frames(&file_path)?;

    // Pass 2: highlight matched pixels with magenta
    for (rgba, _) in &mut decoded.frames {
        for pixel in rgba.chunks_mut(4) {
            if pixel[3] == 0 {
                continue;
            }
            let (r, g, b) = (pixel[0], pixel[1], pixel[2]);
            if dist_sq(r, g, b, target_r, target_g, target_b) <= tol_sq {
                pixel[0] = 255;
                pixel[1] = 0;
                pixel[2] = 255;
            }
        }
    }

    // Pass 3: re-encode
    let result = encode_rgba_frames_to_gif(&decoded);
    eprintln!("[bench] preview_affected total: {}ms", t.elapsed().as_millis());
    result
}

#[tauri::command]
fn get_gif_frame_count(file_path: String) -> Result<usize, String> {
    let file = std::fs::File::open(&file_path).map_err(|e| e.to_string())?;
    let mut options = DecodeOptions::new();
    options.set_color_output(ColorOutput::Indexed);
    let mut decoder = options.read_info(file).map_err(|e| e.to_string())?;
    let mut count = 0usize;
    while decoder.read_next_frame().map_err(|e| e.to_string())?.is_some() {
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
fn preview_frame(
    file_path: String,
    frame_index: usize,
    target_r: u8,
    target_g: u8,
    target_b: u8,
    tolerance: u32,
) -> Result<String, String> {
    let t = std::time::Instant::now();
    let tol_sq = tolerance * tolerance;

    let decoded = decode_to_rgba_frames(&file_path)?;

    let (rgba, delay) = decoded.frames
        .get(frame_index)
        .ok_or_else(|| format!("Frame {} out of range (total: {})", frame_index, decoded.frames.len()))?;

    let mut rgba = rgba.clone();
    for pixel in rgba.chunks_mut(4) {
        if pixel[3] == 0 {
            continue;
        }
        if dist_sq(pixel[0], pixel[1], pixel[2], target_r, target_g, target_b) <= tol_sq {
            pixel[0] = 255;
            pixel[1] = 0;
            pixel[2] = 255;
        }
    }

    let single = DecodedGif {
        width: decoded.width,
        height: decoded.height,
        frames: vec![(rgba, *delay)],
    };

    let result = encode_rgba_frames_to_gif(&single);
    eprintln!("[bench] preview_frame({}) total: {}ms", frame_index, t.elapsed().as_millis());
    result
}

// Re-encodes the GIF without any color transformation.
// If this looks wrong, the bug is in rgba_to_gif_frame / encode step (not decode or transform).
// If this looks correct, the bug is in the color matching / transform logic.
#[tauri::command]
fn debug_roundtrip(file_path: String) -> Result<String, String> {
    let t = std::time::Instant::now();
    let decoded = decode_to_rgba_frames(&file_path)?;
    let result = encode_rgba_frames_to_gif(&decoded);
    eprintln!("[debug_roundtrip] {}ms, {} frames", t.elapsed().as_millis(), decoded.frames.len());
    // Also log unique color count per frame to detect overflow
    for (i, (rgba, _)) in decoded.frames.iter().enumerate() {
        let mut unique: std::collections::HashSet<[u8; 3]> = std::collections::HashSet::new();
        for px in rgba.chunks(4) {
            if px[3] > 0 {
                unique.insert([px[0], px[1], px[2]]);
            }
        }
        eprintln!("[debug_roundtrip] frame {:03}: {} unique opaque colors{}", i, unique.len(),
            if unique.len() > 255 { " *** OVERFLOW > 255 ***" } else { "" });
    }
    result
}

// Exports all decoded frames as PPM files to /tmp/gif-debug/ for visual inspection.
// Use this to verify that the decode/composite step produces correct colors before any transform.
#[tauri::command]
fn debug_export_frames(file_path: String) -> Result<String, String> {
    let decoded = decode_to_rgba_frames(&file_path)?;
    let dir = std::path::Path::new("/tmp/gif-debug");
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;

    // Remove old frames
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let _ = std::fs::remove_file(entry.path());
        }
    }

    for (i, (rgba, delay)) in decoded.frames.iter().enumerate() {
        let path = dir.join(format!("frame_{:03}.ppm", i));
        let mut data = format!("P6\n{} {}\n255\n", decoded.width, decoded.height).into_bytes();
        // PPM needs RGB (no alpha); transparent pixels written as magenta so they're visible
        for pixel in rgba.chunks(4) {
            if pixel[3] == 0 {
                data.extend_from_slice(&[255, 0, 255]); // magenta = transparent
            } else {
                data.extend_from_slice(&pixel[0..3]);
            }
        }
        std::fs::write(&path, &data).map_err(|e| e.to_string())?;
        eprintln!("[debug] frame {:03}: {}×{} delay={}cs  {:?}", i, decoded.width, decoded.height, delay, path);
    }

    // Also log first 5 pixel values of frame 0 for quick sanity check
    if let Some((rgba, _)) = decoded.frames.first() {
        for i in 0..5.min(decoded.width as usize * decoded.height as usize) {
            let b = i * 4;
            eprintln!("[debug] frame0 pixel[{}] = rgba({},{},{},{})", i, rgba[b], rgba[b+1], rgba[b+2], rgba[b+3]);
        }
    }

    Ok(format!("/tmp/gif-debug/  ({} frames, {}×{})", decoded.frames.len(), decoded.width, decoded.height))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GifInfo {
    pub width: u32,
    pub height: u32,
    pub frame_count: usize,
}

#[tauri::command]
fn get_gif_info(file_path: String) -> Result<GifInfo, String> {
    let file = std::fs::File::open(&file_path).map_err(|e| e.to_string())?;
    let mut options = DecodeOptions::new();
    options.set_color_output(ColorOutput::Indexed);
    let mut decoder = options.read_info(file).map_err(|e| e.to_string())?;
    let width = decoder.width() as u32;
    let height = decoder.height() as u32;
    let mut frame_count = 0usize;
    while decoder.read_next_frame().map_err(|e| e.to_string())?.is_some() {
        frame_count += 1;
    }
    Ok(GifInfo { width, height, frame_count })
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            apply_color_changes,
            preview_affected,
            get_gif_frame_count,
            preview_frame,
            apply_frame,
            get_gif_info,
            open_path,
            debug_export_frames,
            debug_roundtrip
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
