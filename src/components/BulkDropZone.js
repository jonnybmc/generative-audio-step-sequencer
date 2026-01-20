import { Toast } from "./Toast.js";

// Filename patterns for auto-assignment (order matters - more specific patterns first)
const SAMPLE_PATTERNS = {
  kick: /kick|kik|bd|bassdrum/i,
  snare: /snare|snr|sd|clap/i,
  "hihat-closed": /hihat.*closed|hh.*cl|closed.*hh|hihat(?!.*open)|hh(?!.*op)|ch(?!op)|^closed\./i,
  "hihat-open": /hihat.*open|hh.*op|open.*hh|oh(?!at)|^open\./i,
};

const SAMPLE_LABELS = {
  kick: "Kick",
  snare: "Snare",
  "hihat-closed": "Closed HH",
  "hihat-open": "Open HH",
};

export class BulkDropZone {
  constructor(audioCtx, audioEngine, gridElement) {
    this.audioCtx = audioCtx;
    this.audioEngine = audioEngine;
    this.gridElement = typeof gridElement === 'string'
      ? document.querySelector(gridElement)
      : gridElement;
    this.init();
  }

  init() {
    this.injectStyles();
    this.createOverlay();
    this.setupDropZone();
  }

  injectStyles() {
    if (document.querySelector('#bulk-drop-styles')) return;

    const style = document.createElement('style');
    style.id = 'bulk-drop-styles';
    style.textContent = `
      .bulk-drop-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(30, 30, 35, 0.95);
        border: 3px dashed #ff6a00;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        z-index: 20;
        backdrop-filter: blur(4px);
      }

      #app.bulk-drag-over .bulk-drop-overlay {
        opacity: 1;
      }

      #app.bulk-drag-over .track-row {
        opacity: 0.3;
      }

      .bulk-drop-overlay-text {
        color: #ffffff;
        font-size: 15px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1.5px;
      }

      .bulk-drop-overlay-hint {
        color: #888;
        font-size: 11px;
        text-align: center;
        max-width: 300px;
        line-height: 1.4;
      }

      .bulk-drop-icon {
        width: 48px;
        height: 48px;
        color: #ff6a00;
        margin-bottom: 8px;
      }

      @keyframes bulk-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.8; }
      }

      #app.bulk-drag-over .bulk-drop-icon {
        animation: bulk-pulse 1s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'bulk-drop-overlay';
    overlay.innerHTML = `
      <svg class="bulk-drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <span class="bulk-drop-overlay-text">Drop multiple samples</span>
      <span class="bulk-drop-overlay-hint">
        Files auto-assign by name:<br/>
        kick.wav, snare.wav, hihat-closed.wav, hihat-open.wav
      </span>
    `;
    this.gridElement.style.position = 'relative';
    this.gridElement.appendChild(overlay);
  }

  setupDropZone() {
    let dragCounter = 0;

    this.gridElement.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;

      // Only show bulk overlay for multiple files
      if (e.dataTransfer.items && e.dataTransfer.items.length > 1) {
        this.gridElement.classList.add('bulk-drag-over');
      }
    });

    this.gridElement.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    this.gridElement.addEventListener('dragleave', (e) => {
      dragCounter--;
      if (dragCounter === 0) {
        this.gridElement.classList.remove('bulk-drag-over');
      }
    });

    this.gridElement.addEventListener('drop', async (e) => {
      // Only handle if bulk overlay is showing (multiple files)
      if (!this.gridElement.classList.contains('bulk-drag-over')) {
        return; // Let individual track handlers deal with single files
      }

      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      this.gridElement.classList.remove('bulk-drag-over');

      const files = Array.from(e.dataTransfer.files).filter(f =>
        f.type.startsWith('audio')
      );

      if (files.length === 0) {
        Toast.show('No audio files found', 'error');
        return;
      }

      await this.assignFiles(files);
    });
  }

  detectSampleType(filename) {
    const name = filename.toLowerCase();

    for (const [key, pattern] of Object.entries(SAMPLE_PATTERNS)) {
      if (pattern.test(name)) {
        return key;
      }
    }
    return null;
  }

  async assignFiles(files) {
    const assignments = {};
    const unmatched = [];

    // First pass: detect and assign
    for (const file of files) {
      const sampleType = this.detectSampleType(file.name);
      if (sampleType) {
        // If we already have this type, keep the first one
        if (!assignments[sampleType]) {
          assignments[sampleType] = file;
        }
      } else {
        unmatched.push(file.name);
      }
    }

    // Process assignments
    const loaded = [];
    const errors = [];

    for (const [sampleKey, file] of Object.entries(assignments)) {
      try {
        const buffer = await file.arrayBuffer();
        const decodedAudio = await this.audioCtx.decodeAudioData(buffer);

        if (decodedAudio.duration > 2) {
          // Warning will be aggregated
        }

        this.audioEngine.replaceSample(decodedAudio, sampleKey);

        // Notify listeners that a sample was replaced
        window.dispatchEvent(new CustomEvent('sample-replaced', {
          detail: { sampleKey, filename: file.name }
        }));

        loaded.push(SAMPLE_LABELS[sampleKey]);
      } catch (error) {
        console.error(`Failed to load ${file.name}:`, error);
        errors.push(file.name);
      }
    }

    // Show results
    if (loaded.length > 0) {
      Toast.show(`Loaded: ${loaded.join(', ')}`, 'success');
    }

    if (unmatched.length > 0) {
      Toast.show(
        `Could not match: ${unmatched.slice(0, 2).join(', ')}${unmatched.length > 2 ? '...' : ''}`,
        'warning'
      );
    }

    if (errors.length > 0) {
      Toast.show(`Failed to decode: ${errors.join(', ')}`, 'error');
    }
  }
}
