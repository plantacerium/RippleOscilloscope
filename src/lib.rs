//! Cyber-Oscilloscope: High-performance audio visualizer
//! 
//! This library provides a GPU-accelerated audio visualizer using WGPU and WebAssembly.

mod renderer;
mod wave;

use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;
use std::sync::{Arc, Mutex};

pub use renderer::Renderer;
pub use wave::{WaveMode, WaveParams};

/// Initialize panic hook for better error messages in browser console
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Audio frequency data passed from JavaScript
#[wasm_bindgen]
pub struct AudioData {
    frequency_data: Vec<f32>,
    time_domain_data: Vec<f32>,
}

#[wasm_bindgen]
impl AudioData {
    #[wasm_bindgen(constructor)]
    pub fn new(fft_size: usize) -> AudioData {
        AudioData {
            frequency_data: vec![0.0; fft_size / 2],
            time_domain_data: vec![0.0; fft_size],
        }
    }

    /// Update frequency data from JavaScript AnalyserNode
    pub fn set_frequency_data(&mut self, data: &[f32]) {
        let len = data.len().min(self.frequency_data.len());
        self.frequency_data[..len].copy_from_slice(&data[..len]);
    }

    /// Update time domain data from JavaScript AnalyserNode
    pub fn set_time_domain_data(&mut self, data: &[f32]) {
        let len = data.len().min(self.time_domain_data.len());
        self.time_domain_data[..len].copy_from_slice(&data[..len]);
    }

    /// Get normalized amplitude (0.0 - 1.0) from frequency data
    pub fn get_amplitude(&self) -> f32 {
        if self.frequency_data.is_empty() {
            return 0.0;
        }
        
        let sum: f32 = self.frequency_data.iter()
            .map(|&x| {
                // Convert from dB scale (-100 to 0) to linear (0 to 1)
                let normalized = (x + 100.0) / 100.0;
                normalized.max(0.0).min(1.0)
            })
            .sum();
        
        (sum / self.frequency_data.len() as f32).min(1.0)
    }

    /// Get frequency bands for visualization
    pub fn get_frequency_bands(&self, num_bands: usize) -> Vec<f32> {
        if self.frequency_data.is_empty() || num_bands == 0 {
            return vec![0.0; num_bands];
        }

        let samples_per_band = self.frequency_data.len() / num_bands;
        let mut bands = Vec::with_capacity(num_bands);

        for i in 0..num_bands {
            let start = i * samples_per_band;
            let end = ((i + 1) * samples_per_band).min(self.frequency_data.len());
            
            let avg: f32 = self.frequency_data[start..end].iter()
                .map(|&x| ((x + 100.0) / 100.0).max(0.0).min(1.0))
                .sum::<f32>() / (end - start) as f32;
            
            bands.push(avg);
        }

        bands
    }
}

/// Main Visualizer struct - entry point for the application
#[wasm_bindgen]
pub struct Visualizer {
    renderer: Option<Renderer>,
    audio_data: Arc<Mutex<AudioData>>,
    wave_params: WaveParams,
    start_time: f64,
}

#[wasm_bindgen]
impl Visualizer {
    /// Create a new Visualizer attached to an HTML canvas element
    #[wasm_bindgen(constructor)]
    pub fn new(canvas_id: &str) -> Result<Visualizer, JsValue> {
        set_panic_hook();
        console_log::init_with_level(log::Level::Info)
            .map_err(|e| JsValue::from_str(&format!("Failed to init logger: {}", e)))?;
        
        log::info!("🎵 Cyber-Oscilloscope initializing...");

        let window = web_sys::window()
            .ok_or_else(|| JsValue::from_str("No window object"))?;
        let document = window.document()
            .ok_or_else(|| JsValue::from_str("No document object"))?;
        let canvas = document.get_element_by_id(canvas_id)
            .ok_or_else(|| JsValue::from_str(&format!("Canvas '{}' not found", canvas_id)))?
            .dyn_into::<HtmlCanvasElement>()
            .map_err(|_| JsValue::from_str("Element is not a canvas"))?;

        let performance = window.performance()
            .ok_or_else(|| JsValue::from_str("No performance object"))?;
        let start_time = performance.now();

        Ok(Visualizer {
            renderer: None,
            audio_data: Arc::new(Mutex::new(AudioData::new(2048))),
            wave_params: WaveParams::default(),
            start_time,
        })
    }

    /// Async initialization of WGPU renderer
    pub async fn init(&mut self, canvas_id: &str) -> Result<(), JsValue> {
        log::info!("⚡ Initializing WGPU renderer...");
        
        let window = web_sys::window()
            .ok_or_else(|| JsValue::from_str("No window object"))?;
        let document = window.document()
            .ok_or_else(|| JsValue::from_str("No document object"))?;
        let canvas = document.get_element_by_id(canvas_id)
            .ok_or_else(|| JsValue::from_str(&format!("Canvas '{}' not found", canvas_id)))?
            .dyn_into::<HtmlCanvasElement>()
            .map_err(|_| JsValue::from_str("Element is not a canvas"))?;

        let renderer = Renderer::new(canvas).await?;
        self.renderer = Some(renderer);
        
        log::info!("✨ Renderer initialized successfully!");
        Ok(())
    }

    /// Update audio data from JavaScript
    pub fn update_audio(&mut self, frequency_data: &[f32], time_domain_data: &[f32]) {
        if let Ok(mut audio) = self.audio_data.lock() {
            audio.set_frequency_data(frequency_data);
            audio.set_time_domain_data(time_domain_data);
        }
    }

    /// Set wave visualization mode
    pub fn set_mode(&mut self, mode: u32) {
        self.wave_params.mode = WaveMode::from_u32(mode);
        log::info!("🌊 Wave mode changed to: {:?}", self.wave_params.mode);
    }

    /// Set wave amplitude
    pub fn set_amplitude(&mut self, amplitude: f32) {
        self.wave_params.amplitude = amplitude.max(0.0).min(2.0);
    }

    /// Set wave frequency
    pub fn set_frequency(&mut self, frequency: f32) {
        self.wave_params.frequency = frequency.max(0.1).min(20.0);
    }

    /// Set wave speed
    pub fn set_speed(&mut self, speed: f32) {
        self.wave_params.speed = speed.max(0.1).min(5.0);
    }

    /// Set color hue (0-360)
    pub fn set_hue(&mut self, hue: f32) {
        self.wave_params.hue = hue % 360.0;
    }

    /// Render a single frame
    pub fn render(&mut self, timestamp: f64) -> Result<(), JsValue> {
        if let Some(ref mut renderer) = self.renderer {
            let time = (timestamp - self.start_time) / 1000.0;
            
            let amplitude = if let Ok(audio) = self.audio_data.lock() {
                audio.get_amplitude()
            } else {
                0.0
            };

            // Apply audio reactivity to wave params
            let mut params = self.wave_params.clone();
            params.amplitude *= 0.5 + amplitude * 1.5;
            
            renderer.render(time as f32, &params)?;
        }
        Ok(())
    }

    /// Resize the canvas
    pub fn resize(&mut self, width: u32, height: u32) -> Result<(), JsValue> {
        if let Some(ref mut renderer) = self.renderer {
            renderer.resize(width, height)?;
        }
        Ok(())
    }
}
