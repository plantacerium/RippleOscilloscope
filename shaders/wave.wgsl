// Cyber-Oscilloscope Wave Shader
// WGSL shader for GPU-accelerated wave visualization

// Uniform data from Rust
struct Uniforms {
    time: f32,
    amplitude: f32,
    frequency: f32,
    speed: f32,
    resolution: vec2<f32>,
    hue: f32,
    mode: u32,
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

// Vertex input/output
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) world_pos: vec2<f32>,
}

// Vertex shader - fullscreen quad
@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.clip_position = vec4<f32>(in.position, 1.0);
    out.uv = in.uv;
    // Map UV to centered coordinates (-1 to 1)
    out.world_pos = (in.uv * 2.0 - 1.0) * vec2<f32>(uniforms.resolution.x / uniforms.resolution.y, 1.0);
    return out;
}

// ==================== UTILITY FUNCTIONS ====================

// HSL to RGB conversion
fn hsl2rgb(h: f32, s: f32, l: f32) -> vec3<f32> {
    let c = (1.0 - abs(2.0 * l - 1.0)) * s;
    let hp = h / 60.0;
    let x = c * (1.0 - abs(hp % 2.0 - 1.0));
    
    var rgb: vec3<f32>;
    if (hp < 1.0) {
        rgb = vec3<f32>(c, x, 0.0);
    } else if (hp < 2.0) {
        rgb = vec3<f32>(x, c, 0.0);
    } else if (hp < 3.0) {
        rgb = vec3<f32>(0.0, c, x);
    } else if (hp < 4.0) {
        rgb = vec3<f32>(0.0, x, c);
    } else if (hp < 5.0) {
        rgb = vec3<f32>(x, 0.0, c);
    } else {
        rgb = vec3<f32>(c, 0.0, x);
    }
    
    let m = l - c / 2.0;
    return rgb + m;
}

// Smooth noise function (simplified)
fn noise(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

// Smooth noise with interpolation
fn smooth_noise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    
    let a = noise(i);
    let b = noise(i + vec2<f32>(1.0, 0.0));
    let c = noise(i + vec2<f32>(0.0, 1.0));
    let d = noise(i + vec2<f32>(1.0, 1.0));
    
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian Motion for organic waves
fn fbm(p: vec2<f32>) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var pos = p;
    
    for (var i = 0; i < 4; i++) {
        value += amplitude * smooth_noise(pos);
        pos *= 2.0;
        amplitude *= 0.5;
    }
    
    return value;
}

// ==================== WAVE MODES ====================

// Mode 0: Sine Waves
fn sine_waves(uv: vec2<f32>, t: f32) -> f32 {
    let freq = uniforms.frequency;
    let amp = uniforms.amplitude;
    
    // Multiple overlapping sine waves
    var wave = sin(uv.x * freq * 3.0 + t * 2.0) * 0.4;
    wave += sin(uv.x * freq * 5.0 - t * 1.5) * 0.3;
    wave += sin(uv.x * freq * 7.0 + t * 2.5) * 0.2;
    wave += sin(uv.x * freq * 11.0 - t * 3.0) * 0.1;
    
    // Add subtle horizontal variation
    wave += sin(uv.y * freq * 2.0 + t) * 0.15;
    
    return wave * amp;
}

// Mode 1: Circular Ripples
fn circular_ripples(uv: vec2<f32>, t: f32) -> f32 {
    let freq = uniforms.frequency;
    let amp = uniforms.amplitude;
    
    let dist = length(uv);
    let wave = sin(dist * freq * 10.0 - t * 3.0);
    let fade = exp(-dist * 0.5);
    
    // Add secondary ripple sources
    let dist2 = length(uv - vec2<f32>(0.5, 0.3));
    let wave2 = sin(dist2 * freq * 8.0 - t * 2.5) * 0.5;
    let fade2 = exp(-dist2 * 0.7);
    
    let dist3 = length(uv + vec2<f32>(0.4, -0.2));
    let wave3 = sin(dist3 * freq * 9.0 - t * 2.8) * 0.3;
    let fade3 = exp(-dist3 * 0.6);
    
    return (wave * fade + wave2 * fade2 + wave3 * fade3) * amp;
}

// Mode 2: Lissajous Curves
fn lissajous_curves(uv: vec2<f32>, t: f32) -> f32 {
    let freq = uniforms.frequency;
    let amp = uniforms.amplitude;
    
    // Lissajous interference pattern
    let a = 3.0 * freq;
    let b = 2.0 * freq;
    let delta = t * 0.5;
    
    let lx = sin(a * uv.x + t);
    let ly = sin(b * uv.y + delta);
    
    let pattern = lx * ly;
    
    // Add secondary pattern
    let lx2 = sin(a * 1.5 * uv.x - t * 1.2);
    let ly2 = cos(b * 1.3 * uv.y + delta * 0.8);
    
    return (pattern + lx2 * ly2 * 0.5) * amp;
}

// Mode 3: Plasma Field
fn plasma_field(uv: vec2<f32>, t: f32) -> f32 {
    let freq = uniforms.frequency;
    let amp = uniforms.amplitude;
    
    var pos = uv * freq;
    
    // Classic plasma formula
    var value = sin(pos.x + t);
    value += sin(pos.y + t);
    value += sin(pos.x + pos.y + t);
    
    let dist = length(pos);
    value += sin(dist - t * 2.0);
    
    // Add turbulence
    value += fbm(pos * 0.5 + t * 0.3) * 2.0;
    
    return value * 0.2 * amp;
}

// Mode 4: Wave Surface (3D perspective)
fn wave_surface(uv: vec2<f32>, t: f32) -> f32 {
    let freq = uniforms.frequency;
    let amp = uniforms.amplitude;
    
    // Perspective transformation
    let perspective = 1.0 / (1.0 + uv.y * 0.5);
    var pos = uv;
    pos.x *= perspective;
    pos *= freq;
    
    // Wave height
    var wave = sin(pos.x * 3.0 + t * 2.0) * cos(pos.y * 2.0 + t);
    wave += sin(pos.x * 5.0 - pos.y * 3.0 + t * 1.5) * 0.5;
    wave += sin((pos.x + pos.y) * 2.0 + t * 0.8) * 0.3;
    
    return wave * amp * perspective;
}

// ==================== GLOW EFFECTS ====================

fn glow_line(uv: vec2<f32>, wave_height: f32, thickness: f32) -> f32 {
    let dist = abs(uv.y - wave_height);
    let glow = exp(-dist * dist / (thickness * thickness));
    return glow;
}

fn bloom(intensity: f32, power: f32) -> f32 {
    return pow(max(intensity, 0.0), power);
}

// ==================== FRAGMENT SHADER ====================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let uv = in.world_pos;
    let t = uniforms.time * uniforms.speed;
    
    var wave: f32;
    
    // Calculate wave based on mode
    switch uniforms.mode {
        case 0u: {
            wave = sine_waves(uv, t);
        }
        case 1u: {
            wave = circular_ripples(uv, t);
        }
        case 2u: {
            wave = lissajous_curves(uv, t);
        }
        case 3u: {
            wave = plasma_field(uv, t);
        }
        case 4u: {
            wave = wave_surface(uv, t);
        }
        default: {
            wave = sine_waves(uv, t);
        }
    }
    
    // Create glowing line effect
    let line_thickness = 0.08;
    let glow1 = glow_line(uv, wave * 0.5, line_thickness);
    let glow2 = glow_line(uv, wave * 0.5, line_thickness * 3.0) * 0.5;
    let glow3 = glow_line(uv, wave * 0.5, line_thickness * 8.0) * 0.2;
    
    let total_glow = glow1 + glow2 + glow3;
    
    // Dynamic color based on wave position and time
    let hue_shift = uniforms.hue + wave * 30.0 + uv.x * 20.0;
    let hue = (hue_shift % 360.0 + 360.0) % 360.0;
    
    // Primary color (cyan-magenta gradient)
    let primary_color = hsl2rgb(hue, 0.9, 0.5 + glow1 * 0.3);
    
    // Secondary glow color (complementary)
    let secondary_hue = (hue + 180.0) % 360.0;
    let secondary_color = hsl2rgb(secondary_hue, 0.8, 0.4);
    
    // Mix colors based on glow intensity
    var color = primary_color * glow1;
    color += secondary_color * glow2 * 0.5;
    color += vec3<f32>(0.1, 0.05, 0.15) * glow3;
    
    // Add bloom effect
    let bloom_amount = bloom(total_glow, 2.0) * 0.3;
    color += primary_color * bloom_amount;
    
    // Background gradient
    let bg_gradient = 0.02 + uv.y * 0.01;
    let bg_color = vec3<f32>(0.02, 0.02, 0.05) + vec3<f32>(0.01, 0.0, 0.02) * (1.0 - abs(uv.y));
    
    // Add subtle grid pattern
    let grid = sin(uv.x * 50.0) * sin(uv.y * 50.0);
    let grid_intensity = (grid * 0.5 + 0.5) * 0.02;
    
    // Final composition
    var final_color = color + bg_color;
    final_color += vec3<f32>(0.0, 0.02, 0.03) * grid_intensity;
    
    // Add vignette
    let vignette = 1.0 - length(in.uv - 0.5) * 0.5;
    final_color *= vignette;
    
    // Tone mapping and gamma correction
    final_color = final_color / (final_color + 1.0); // Reinhard tone mapping
    final_color = pow(final_color, vec3<f32>(1.0 / 2.2)); // Gamma correction
    
    return vec4<f32>(final_color, 1.0);
}
