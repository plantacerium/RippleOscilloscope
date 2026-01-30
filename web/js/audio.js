/**
 * Web Audio API Integration
 * Handles microphone input and FFT analysis
 */

export class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isActive = false;
        this.fftSize = 2048;
        this.frequencyData = null;
        this.timeDomainData = null;
    }

    /**
     * Initialize audio context and microphone
     * @returns {Promise<boolean>} Success status
     */
    async init() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.8;
            this.analyser.minDecibels = -100;
            this.analyser.maxDecibels = -10;

            // Initialize data arrays
            this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
            this.timeDomainData = new Float32Array(this.analyser.fftSize);

            console.log('🎵 AudioAnalyzer initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize AudioAnalyzer:', error);
            return false;
        }
    }

    /**
     * Request microphone access and connect
     * @returns {Promise<boolean>} Success status
     */
    async enableMicrophone() {
        try {
            if (!this.audioContext) {
                await this.init();
            }

            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Create media stream source
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            // Connect to analyser
            this.microphone.connect(this.analyser);
            
            this.isActive = true;
            console.log('🎤 Microphone enabled');
            return true;
        } catch (error) {
            console.error('❌ Microphone access denied:', error);
            return false;
        }
    }

    /**
     * Disable microphone
     */
    disableMicrophone() {
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        this.isActive = false;
        console.log('🔇 Microphone disabled');
    }

    /**
     * Toggle microphone on/off
     * @returns {Promise<boolean>} New active state
     */
    async toggle() {
        if (this.isActive) {
            this.disableMicrophone();
            return false;
        } else {
            return await this.enableMicrophone();
        }
    }

    /**
     * Get current frequency data
     * @returns {Float32Array} Frequency data in dB
     */
    getFrequencyData() {
        if (this.analyser && this.isActive) {
            this.analyser.getFloatFrequencyData(this.frequencyData);
        }
        return this.frequencyData;
    }

    /**
     * Get current time domain data (waveform)
     * @returns {Float32Array} Time domain data
     */
    getTimeDomainData() {
        if (this.analyser && this.isActive) {
            this.analyser.getFloatTimeDomainData(this.timeDomainData);
        }
        return this.timeDomainData;
    }

    /**
     * Get normalized amplitude (0-1)
     * @returns {number} Normalized amplitude
     */
    getAmplitude() {
        if (!this.isActive) return 0;

        const data = this.getFrequencyData();
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const normalized = (data[i] + 100) / 100;
            sum += Math.max(0, Math.min(1, normalized));
        }
        return Math.min(1, sum / data.length);
    }

    /**
     * Get frequency bands for visualization
     * @param {number} numBands Number of frequency bands
     * @returns {number[]} Array of normalized band values (0-1)
     */
    getFrequencyBands(numBands = 12) {
        if (!this.isActive) {
            return new Array(numBands).fill(0.1);
        }

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

    /**
     * Get bass, mid, and treble levels
     * @returns {{bass: number, mid: number, treble: number}}
     */
    getFrequencyRanges() {
        if (!this.isActive) {
            return { bass: 0, mid: 0, treble: 0 };
        }

        const data = this.getFrequencyData();
        const third = Math.floor(data.length / 3);

        const normalize = (arr) => {
            let sum = 0;
            for (const val of arr) {
                sum += Math.max(0, Math.min(1, (val + 100) / 100));
            }
            return sum / arr.length;
        };

        return {
            bass: normalize(data.slice(0, third)),
            mid: normalize(data.slice(third, third * 2)),
            treble: normalize(data.slice(third * 2))
        };
    }
}
