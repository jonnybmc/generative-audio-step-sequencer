import { Toast } from "./Toast.js";

const TRACK_TO_SAMPLE_KEY = {
  0: "kick",
  1: "snare",
  2: "hihat-closed",
  3: "hihat-open",
};

const TRACK_LABELS = {
  0: "KICK",
  1: "SNARE",
  2: "HI-HAT",
  3: "OPEN HH",
};

// Folder icon SVG (similar to DAW sample browser)
const FOLDER_ICON = `<svg class="folder-icon" viewBox="0 0 24 24" fill="currentColor">
  <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
</svg>`;

// Track if styles have been injected (shared across instances)
let stylesInjected = false;

export class SampleUploader {
  constructor(audioCtx, audioEngine, track, domElement) {
    this.audioCtx = audioCtx;
    this.audioEngine = audioEngine;
    this.containerElement = document.querySelector(domElement);
    this.track = track;
    this.sampleKey = TRACK_TO_SAMPLE_KEY[track];
    this.trackLabel = TRACK_LABELS[track];
    this.init();
  }

  init() {
    this.injectStyles();
    this.createOverlay();
    this.createFileInput();
    this.createUploadButton();
    this.setupDropZone();
    this.render();
  }

  injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;

    const style = document.createElement("style");
    style.textContent = `
      .sample-drop-zone {
        position: relative;
      }

      .sample-drop-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(30, 30, 35, 0.92);
        border: 2px solid #ff6a00;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s ease;
        z-index: 10;
        backdrop-filter: blur(2px);
      }

      .sample-drop-zone.drag-over .sample-drop-overlay {
        opacity: 1;
      }

      .sample-drop-overlay-text {
        color: #ffffff;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .sample-drop-overlay-track {
        color: #ff6a00;
        font-size: 11px;
        font-weight: 700;
        margin-top: 6px;
      }

      /* Progressive disclosure - hide controls during drag */
      .sample-drop-zone.drag-over .swing-lock-btn,
      .sample-drop-zone.drag-over .track-dial-container,
      .sample-drop-zone.drag-over .mini-dial-wrapper {
        opacity: 0;
        transition: opacity 0.15s ease;
      }

      /* Subtle border animation on drag-over */
      .sample-drop-zone.drag-over .sample-drop-overlay {
        animation: dropzone-glow 1.2s ease-in-out infinite;
      }

      @keyframes dropzone-glow {
        0%, 100% {
          border-color: #ff6a00;
          box-shadow: 0 0 12px rgba(255, 106, 0, 0.3);
        }
        50% {
          border-color: #ff8533;
          box-shadow: 0 0 20px rgba(255, 106, 0, 0.5);
        }
      }

      /* Success flash animation */
      .sample-drop-zone.drop-success {
        animation: drop-success-flash 0.4s ease-out;
      }

      @keyframes drop-success-flash {
        0% { box-shadow: inset 0 0 0 3px #22c55e; }
        100% { box-shadow: inset 0 0 0 0px transparent; }
      }

      /* Track name container with border */
      .track-name-container {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 2px 6px;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid #4a4a4a;
        border-radius: 4px;
        width: 85%;
    justify-content: space-between;
      }

      /* Track name row with folder button */
      .track-name-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Upload/folder button styles */
      .sample-upload-btn {
        width: 18px;
        height: 18px;
        padding: 2px;
        background: transparent;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        opacity: 0.5;
      }

      .sample-upload-btn:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.1);
      }

      .sample-upload-btn:active {
        transform: scale(0.9);
      }

      .folder-icon {
        width: 14px;
        height: 14px;
        color: #888;
        transition: color 0.15s ease;
      }

      .sample-upload-btn:hover .folder-icon {
        color: var(--tr909-orange, #ff6a00);
      }

      /* Hide upload button during drag */
      .sample-drop-zone.drag-over .sample-upload-btn {
        opacity: 0;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  createOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "sample-drop-overlay";
    overlay.innerHTML = `
      <span class="sample-drop-overlay-text">Drop to replace</span>
      <span class="sample-drop-overlay-track">${this.trackLabel}</span>
    `;
    this.containerElement.appendChild(overlay);
  }

  createFileInput() {
    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.accept = "audio/*";
    this.fileInput.className = "sample-file-input";
    this.fileInput.hidden = true;
    this.fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFile(file);
      }
      // Reset input so same file can be selected again
      this.fileInput.value = "";
    });
    this.containerElement.appendChild(this.fileInput);
  }

  createUploadButton() {
    // Find the track-name element and wrap it with the folder button in a bordered container
    const trackName = this.containerElement.querySelector(".track-name");
    if (!trackName) return;

    // Create bordered container
    const container = document.createElement("div");
    container.className = "track-name-container";

    // Create folder button
    const btn = document.createElement("button");
    btn.className = "sample-upload-btn";
    btn.title = `Load ${this.trackLabel} sample`;
    btn.innerHTML = FOLDER_ICON;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.fileInput.click();
    });

    // Replace track-name with container holding both name and button
    trackName.parentNode.insertBefore(container, trackName);
    container.appendChild(trackName);
    container.appendChild(btn);
  }

  async handleFile(file) {
    if (!file.type.startsWith("audio")) {
      Toast.show("Please select an audio file", "error");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const decodedAudio = await this.audioCtx.decodeAudioData(buffer);

      if (decodedAudio.duration > 2) {
        Toast.show("Sample truncated to 2 seconds", "warning");
      }

      this.audioEngine.replaceSample(decodedAudio, this.sampleKey);

      // Notify listeners that a sample was replaced
      window.dispatchEvent(
        new CustomEvent("sample-replaced", {
          detail: { sampleKey: this.sampleKey, filename: file.name },
        }),
      );

      // Success flash animation
      this.containerElement.classList.add("drop-success");
      setTimeout(
        () => this.containerElement.classList.remove("drop-success"),
        400,
      );

      Toast.show(`${file.name} loaded`, "success");
    } catch (error) {
      console.error("Failed to load sample:", error);
      Toast.show("Could not decode audio file", "error");
    }
  }

  render() {}

  setupDropZone() {
    const dropZone = this.containerElement;
    this.dragover(dropZone);
    this.dragleave(dropZone);
    this.drop(dropZone);
  }

  dragover(elem) {
    elem.addEventListener("dragover", (e) => {
      e.preventDefault();
      elem.classList.add("drag-over");
    });
  }

  dragleave(elem) {
    elem.addEventListener("dragleave", (e) => {
      // Only remove if we're actually leaving the element (not entering a child)
      if (!elem.contains(e.relatedTarget)) {
        elem.classList.remove("drag-over");
      }
    });
  }

  drop(elem) {
    elem.addEventListener("drop", async (e) => {
      e.preventDefault();
      elem.classList.remove("drag-over");

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      this.handleFile(files[0]);
    });
  }
}
