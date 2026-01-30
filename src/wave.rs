//! Wave physics and parameter definitions

use wasm_bindgen::prelude::*;

/// Wave visualization modes
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum WaveMode {
    /// Classic sine wave visualization
    SineWaves = 0,
    /// Circular ripple patterns from center
    CircularRipples = 1,
    /// Complex Lissajous orbital curves
    LissajousCurves = 2,
    /// Plasma-like wave interference
    PlasmaField = 3,
    /// 3D wave surface perspective
    WaveSurface = 4,
}

impl WaveMode {
    pub fn from_u32(value: u32) -> Self {
        match value {
            0 => WaveMode::SineWaves,
            1 => WaveMode::CircularRipples,
            2 => WaveMode::LissajousCurves,
            3 => WaveMode::PlasmaField,
            4 => WaveMode::WaveSurface,
            _ => WaveMode::SineWaves,
        }
    }
}

impl Default for WaveMode {
    fn default() -> Self {
        WaveMode::SineWaves
    }
}

/// Parameters controlling wave visualization
#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct WaveParams {
    /// Wave amplitude (height)
    pub amplitude: f32,
    /// Wave frequency (number of waves)
    pub frequency: f32,
    /// Animation speed
    pub speed: f32,
    /// Color hue (0-360)
    pub hue: f32,
    /// Visualization mode
    pub mode: WaveMode,
}

impl Default for WaveParams {
    fn default() -> Self {
        WaveParams {
            amplitude: 1.0,
            frequency: 3.0,
            speed: 1.0,
            hue: 180.0,
            mode: WaveMode::SineWaves,
        }
    }
}

#[wasm_bindgen]
impl WaveParams {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }
}

/// Calculate wave displacement at a point
/// This is used for generating wave mesh vertices
pub fn calculate_wave(x: f32, y: f32, time: f32, params: &WaveParams) -> f32 {
    let t = time * params.speed;
    
    match params.mode {
        WaveMode::SineWaves => {
            // Multiple layered sine waves
            let wave1 = (x * params.frequency + t).sin();
            let wave2 = (y * params.frequency * 0.7 + t * 1.3).sin() * 0.5;
            let wave3 = ((x + y) * params.frequency * 0.5 + t * 0.7).sin() * 0.3;
            (wave1 + wave2 + wave3) * params.amplitude
        }
        WaveMode::CircularRipples => {
            // Circular waves emanating from center
            let dist = (x * x + y * y).sqrt();
            (dist * params.frequency - t * 2.0).sin() * params.amplitude * (-dist * 0.5).exp()
        }
        WaveMode::LissajousCurves => {
            // Lissajous pattern interference
            let lx = (x * params.frequency * 3.0 + t).sin();
            let ly = (y * params.frequency * 2.0 + t * 1.5).sin();
            (lx * ly) * params.amplitude
        }
        WaveMode::PlasmaField => {
            // Plasma-like interference pattern
            let cx = (x * params.frequency + t).sin();
            let cy = (y * params.frequency + t).sin();
            let c1 = (x * params.frequency + y * params.frequency + t).sin();
            let d = (x * x + y * y).sqrt();
            let c2 = (d * params.frequency * 0.5 + t).sin();
            ((cx + cy + c1 + c2) * 0.25) * params.amplitude
        }
        WaveMode::WaveSurface => {
            // 3D wave surface
            let wave1 = ((x * params.frequency).sin() + (y * params.frequency).cos() + t).sin();
            let wave2 = ((x - y) * params.frequency * 0.5 + t * 0.7).sin() * 0.5;
            (wave1 + wave2) * params.amplitude
        }
    }
}
