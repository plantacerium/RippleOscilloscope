/**
 * Cyber-Oscilloscope Main Application
 * Bootstraps WASM module, audio engine, and UI controls
 */

/**
 * Cyber-Oscilloscope Main Application
 * Bootstraps WASM module, audio engine, and UI controls
 */

// --- AudioAnalyzer Class (Merged for reliability) ---
class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isActive = false;
        this.fftSize = 2048;
        this.frequencyData = null;
        this.timeDomainData = null;
    }

    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.8;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -30;
            this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
            this.timeDomainData = new Float32Array(this.analyser.fftSize);
            console.log('🎵 AudioAnalyzer initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize AudioAnalyzer:', error);
            return false;
        }
    }

    async enableMicrophone() {
        try {
            if (!this.audioContext) await this.init();
            if (this.audioContext.state === 'suspended') await this.audioContext.resume();

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });

            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            this.isActive = true;
            console.log('🎤 Microphone enabled');
            return true;
        } catch (error) {
            console.error('❌ Microphone access denied:', error);
            return false;
        }
    }

    disableMicrophone() {
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        this.isActive = false;
        console.log('🔇 Microphone disabled');
    }

    async toggle() {
        if (this.isActive) {
            this.disableMicrophone();
            return false;
        } else {
            return await this.enableMicrophone();
        }
    }

    getFrequencyData() {
        if (this.analyser && this.isActive) {
            this.analyser.getFloatFrequencyData(this.frequencyData);
        }
        return this.frequencyData;
    }

    getAmplitude() {
        if (!this.isActive) return 0;
        const data = this.getFrequencyData();
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const normalized = (data[i] + 90) / 60;
            sum += Math.max(0, Math.min(1, normalized));
        }
        let avg = sum / data.length;
        return Math.pow(avg, 0.8) * 1.5;
    }

    getFrequencyBands(numBands = 12) {
        if (!this.isActive) return new Array(numBands).fill(0.1);
        const data = this.getFrequencyData();
        const bands = [];
        const samplesPerBand = Math.floor(data.length / numBands);
        for (let i = 0; i < numBands; i++) {
            const start = i * samplesPerBand;
            const end = Math.min((i + 1) * samplesPerBand, data.length);
            let sum = 0;
            for (let j = start; j < end; j++) {
                const normalized = (data[j] + 100) / 100;
                sum += Math.max(0, Math.min(1, normalized));
            }
            bands.push(sum / (end - start));
        }
        return bands;
    }
}
// --- End AudioAnalyzer ---

// Application state
const state = {
    visualizer: null,
    audioAnalyzer: null,
    isRunning: false,
    lastFrameTime: 0,
    frameCount: 0,
    fps: 60,
    currentMode: 0
};

// DOM Elements
const elements = {
    canvas: null,
    loadingOverlay: null,
    progressBar: null,
    errorModal: null,
    fpsValue: null,
    audioValue: null,
    resolutionDisplay: null,
    amplitudeMeter: null,
    frequencyBars: null,
    modeButtons: null
};

/**
 * Initialize the application
 */
async function init() {
    console.log('🚀 Cyber-Oscilloscope starting...');

    // Cache DOM elements
    cacheElements();

    // Check WebGPU support
    if (!checkWebGPUSupport()) {
        showError();
        return;
    }

    // Update progress
    updateProgress(10, 'Checking WebGPU support...');

    try {
        // Initialize audio analyzer
        updateProgress(30, 'Initializing audio engine...');
        state.audioAnalyzer = new AudioAnalyzer(); // Use local class
        await state.audioAnalyzer.init();

        // Initialize canvas size
        updateProgress(50, 'Preparing canvas...');
        resizeCanvas();

        // Load and initialize WASM module
        updateProgress(70, 'Loading engine...');
        await initWasm();

        // Setup event listeners
        updateProgress(90, 'Setting up controls...');
        setupEventListeners();

        // Hide loading overlay
        updateProgress(100, 'Ready!');
        setTimeout(() => {
            if (elements.loadingOverlay) elements.loadingOverlay.classList.add('hidden');
            startRenderLoop();
        }, 500);

    } catch (error) {
        console.error('❌ Initialization failed:', error);
        showError();
    }
}

/**
 * Cache DOM elements for performance
 */
function cacheElements() {
    elements.canvas = document.getElementById('visualizer-canvas');
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.progressBar = document.getElementById('progress-bar');
    elements.errorModal = document.getElementById('error-modal');
    elements.fpsValue = document.getElementById('fps-value');
    elements.audioValue = document.getElementById('audio-value');
    elements.resolutionDisplay = document.getElementById('resolution-display');
    elements.amplitudeMeter = document.getElementById('amplitude-meter');
    elements.frequencyBars = document.querySelectorAll('.freq-bar');
    elements.modeButtons = document.querySelectorAll('.mode-button');
}

/**
 * Check if WebGPU is supported
 */
function checkWebGPUSupport() {
    if (!navigator.gpu) {
        console.error('❌ WebGPU not supported');
        return false;
    }
    console.log('✅ WebGPU supported');
    return true;
}

/**
 * Initialize WASM module
 */
async function initWasm() {
    // Directly use fallback for robustness
    await initWebGPUFallback();
}

/**
 * WebGPU JavaScript fallback
 */
async function initWebGPUFallback() {
    const canvas = elements.canvas;
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
    });

    if (!adapter) {
        throw new Error('Failed to get GPU adapter');
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format,
        alphaMode: 'premultiplied'
    });

    // Use inline shader directly to avoid fetch/404 issues
    const shaderCode = getInlineShader();

    const shaderModule = device.createShaderModule({
        label: 'Wave Shader',
        code: shaderCode
    });

    // Create uniform buffer
    const uniformBuffer = device.createBuffer({
        size: 32, // 8 floats * 4 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Create bind group layout
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' }
        }]
    });

    // Create bind group
    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }]
    });

    // Create pipeline layout
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
    });

    // Create render pipeline
    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 20, // 3 floats pos + 2 floats uv
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' },
                    { shaderLocation: 1, offset: 12, format: 'float32x2' }
                ]
            }]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [{ format }]
        },
        primitive: {
            topology: 'triangle-list'
        }
    });

    // Create vertex buffer (fullscreen quad)
    const vertices = new Float32Array([
        // pos (x, y, z), uv (u, v)
        -1, -1, 0, 0, 1,
        1, -1, 0, 1, 1,
        1, 1, 0, 1, 0,
        -1, -1, 0, 0, 1,
        1, 1, 0, 1, 0,
        -1, 1, 0, 0, 0
    ]);

    const vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    // Store state for rendering
    state.visualizer = {
        device,
        context,
        pipeline,
        vertexBuffer,
        uniformBuffer,
        bindGroup,
        params: {
            amplitude: 1.0,
            frequency: 3.0,
            speed: 1.0,
            hue: 180.0,
            mode: 0
        },
        render(time) {
            const width = canvas.width;
            const height = canvas.height;

            // Get audio amplitude
            const audioAmp = state.audioAnalyzer?.getAmplitude() || 0;
            const effectiveAmp = this.params.amplitude * (0.5 + audioAmp * 1.5);

            // Update uniforms
            const uniforms = new Float32Array([
                time,                    // time
                effectiveAmp,            // amplitude
                this.params.frequency,   // frequency
                this.params.speed,       // speed
                width,                   // resolution.x
                height,                  // resolution.y
                this.params.hue,         // hue
                this.params.mode         // mode (as float, will be cast to u32 in shader)
            ]);
            device.queue.writeBuffer(uniformBuffer, 0, uniforms);

            // Render
            const commandEncoder = device.createCommandEncoder();
            const textureView = context.getCurrentTexture().createView();

            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: textureView,
                    clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store'
                }]
            });

            renderPass.setPipeline(pipeline);
            renderPass.setBindGroup(0, bindGroup);
            renderPass.setVertexBuffer(0, vertexBuffer);
            renderPass.draw(6);
            renderPass.end();

            device.queue.submit([commandEncoder.finish()]);
        },
        setMode(mode) { this.params.mode = mode; },
        setAmplitude(val) { this.params.amplitude = val; },
        setFrequency(val) { this.params.frequency = val; },
        setSpeed(val) { this.params.speed = val; },
        setHue(val) { this.params.hue = val; },
        resize(width, height) {
            canvas.width = width;
            canvas.height = height;
        }
    };

    console.log('✨ WebGPU renderer initialized');
}

/**
 * Inline shader fallback if external file fails to load
 */
function getInlineShader() {
    return `
struct Uniforms {
    time: f32,
    amplitude: f32,
    frequency: f32,
    speed: f32,
    resolution: vec2<f32>,
    hue: f32,
    mode: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) world_pos: vec2<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.clip_position = vec4<f32>(in.position, 1.0);
    out.uv = in.uv;
    out.world_pos = (in.uv * 2.0 - 1.0) * vec2<f32>(uniforms.resolution.x / uniforms.resolution.y, 1.0);
    return out;
}

fn hsl2rgb(h: f32, s: f32, l: f32) -> vec3<f32> {
    let c = (1.0 - abs(2.0 * l - 1.0)) * s;
    let hp = h / 60.0;
    let x = c * (1.0 - abs(hp % 2.0 - 1.0));
    var rgb: vec3<f32>;
    if (hp < 1.0) { rgb = vec3<f32>(c, x, 0.0); }
    else if (hp < 2.0) { rgb = vec3<f32>(x, c, 0.0); }
    else if (hp < 3.0) { rgb = vec3<f32>(0.0, c, x); }
    else if (hp < 4.0) { rgb = vec3<f32>(0.0, x, c); }
    else if (hp < 5.0) { rgb = vec3<f32>(x, 0.0, c); }
    else { rgb = vec3<f32>(c, 0.0, x); }
    return rgb + l - c / 2.0;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let uv = in.world_pos;
    let t = uniforms.time * uniforms.speed;
    
    var wave: f32;
    switch u32(uniforms.mode + 0.1) {
        case 0u: { // Sine waves
            wave = sin(uv.x * uniforms.frequency * 3.0 + t * 2.0) * 0.4;
            wave += sin(uv.x * uniforms.frequency * 5.0 - t * 1.5) * 0.3;
            wave += sin(uv.x * uniforms.frequency * 7.0 + t * 2.5) * 0.2;
        }
        case 1u: { // Circular ripples
            let dist = length(uv);
            wave = sin(dist * uniforms.frequency * 10.0 - t * 3.0) * exp(-dist * 0.5);
        }
        case 2u: { // Lissajous (FM Synthesis look)
            // Complex FM Oscillator style
            wave = sin(uv.x * uniforms.frequency + t) * cos(uv.x * uniforms.frequency * 0.5 - t * 1.5) * 0.8;
            wave += sin(uv.x * uniforms.frequency * 2.0 + t) * 0.2;
        }
        case 3u: { // Plasma
            var value = sin(uv.x * uniforms.frequency + t);
            value += sin(uv.y * uniforms.frequency + t);
            value += sin((uv.x + uv.y) * uniforms.frequency + t);
            value += sin(length(uv * uniforms.frequency) - t * 2.0);
            wave = value * 0.25;
        }
        default: { // Surface
            wave = sin(uv.x * uniforms.frequency * 3.0 + t * 2.0) * cos(uv.y * uniforms.frequency * 2.0 + t);
        }
    }
    wave *= uniforms.amplitude;
    
    let dist = abs(uv.y - wave * 0.5);
    let glow = exp(-dist * dist / 0.006) + exp(-dist * dist / 0.05) * 0.5;
    
    let hue = (uniforms.hue + wave * 30.0 + uv.x * 20.0) % 360.0;
    let color = hsl2rgb(hue, 0.9, 0.5 + glow * 0.3) * glow;
    
    let bg = vec3<f32>(0.02, 0.02, 0.05);
    var final_color = color + bg;
    final_color = final_color / (final_color + 1.0);
    final_color = pow(final_color, vec3<f32>(1.0 / 2.2));
    
    return vec4<f32>(final_color, 1.0);
}`;
}

/**
 * Setup event listeners for UI controls
 */
function setupEventListeners() {
    // Window resize
    window.addEventListener('resize', resizeCanvas);

    // Audio button
    const audioBtn = document.getElementById('btn-audio');
    audioBtn?.addEventListener('click', toggleAudio);

    // Mode buttons
    elements.modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = parseInt(btn.dataset.mode);
            setMode(mode);
        });
    });

    // Sliders
    setupSlider('amplitude', (val) => {
        state.visualizer?.setAmplitude(parseFloat(val));
        document.getElementById('amplitude-value').textContent = val;
    });

    setupSlider('frequency', (val) => {
        state.visualizer?.setFrequency(parseFloat(val));
        document.getElementById('frequency-value').textContent = val;
    });

    setupSlider('speed', (val) => {
        state.visualizer?.setSpeed(parseFloat(val));
        document.getElementById('speed-value').textContent = val;
    });

    setupSlider('hue', (val) => {
        state.visualizer?.setHue(parseFloat(val));
        document.getElementById('hue-value').textContent = val + '°';
    });
}

/**
 * Setup a slider with callback
 */
function setupSlider(id, callback) {
    const slider = document.getElementById(id);
    if (slider) {
        slider.addEventListener('input', (e) => callback(e.target.value));
        callback(slider.value); // Initialize
    }
}

/**
 * Toggle audio on/off
 */
async function toggleAudio() {
    const btn = document.getElementById('btn-audio');
    const statusValue = elements.audioValue;

    if (state.audioAnalyzer) {
        const isActive = await state.audioAnalyzer.toggle();

        if (isActive) {
            btn.innerHTML = '<span class="button-icon">🎤</span><span class="button-text">DISABLE MICROPHONE</span>';
            btn.classList.add('active');
            statusValue.textContent = 'ON';
            statusValue.classList.remove('status-inactive');
            statusValue.classList.add('status-active');
        } else {
            btn.innerHTML = '<span class="button-icon">🎤</span><span class="button-text">ENABLE MICROPHONE</span>';
            btn.classList.remove('active');
            statusValue.textContent = 'OFF';
            statusValue.classList.add('status-inactive');
            statusValue.classList.remove('status-active');
        }
    }
}

/**
 * Set visualization mode
 */
function setMode(mode) {
    state.currentMode = mode;
    state.visualizer?.setMode(mode);

    elements.modeButtons.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.mode) === mode);
    });
}

/**
 * Resize canvas to window size
 */
function resizeCanvas() {
    const canvas = elements.canvas;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    state.visualizer?.resize(width, height);

    if (elements.resolutionDisplay) {
        elements.resolutionDisplay.textContent = `${width} × ${height}`;
    }
}

/**
 * Main render loop
 */
function startRenderLoop() {
    state.isRunning = true;
    state.lastFrameTime = performance.now();
    requestAnimationFrame(render);
}

/**
 * Render frame
 */
function render(timestamp) {
    if (!state.isRunning) return;

    // Calculate FPS
    state.frameCount++;
    if (timestamp - state.lastFrameTime >= 1000) {
        state.fps = state.frameCount;
        state.frameCount = 0;
        state.lastFrameTime = timestamp;
        if (elements.fpsValue) {
            elements.fpsValue.textContent = state.fps;
        }
    }

    // Render visualizer
    const time = timestamp / 1000;
    state.visualizer?.render(time);

    // Update UI elements
    updateUI();

    requestAnimationFrame(render);
}

/**
 * Update UI elements with audio data
 */
function updateUI() {
    if (!state.audioAnalyzer?.isActive) return;

    // Update amplitude meter
    const amplitude = state.audioAnalyzer.getAmplitude();
    if (elements.amplitudeMeter) {
        elements.amplitudeMeter.style.height = (amplitude * 100) + '%';
    }

    // Update frequency bars
    const bands = state.audioAnalyzer.getFrequencyBands(12);
    elements.frequencyBars.forEach((bar, i) => {
        const value = bands[i] || 0;
        bar.style.height = Math.max(10, value * 100) + '%';
        bar.style.opacity = 0.5 + value * 0.5;
    });
}

/**
 * Update progress bar
 */
function updateProgress(percent, message) {
    if (elements.progressBar) {
        elements.progressBar.style.width = percent + '%';
    }
    const loadingText = document.querySelector('.loading-text');
    if (loadingText && message) {
        loadingText.textContent = message;
    }
}

/**
 * Show error modal
 */
function showError() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.add('hidden');
    }
    if (elements.errorModal) {
        elements.errorModal.classList.add('visible');
    }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
