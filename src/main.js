import { Clock } from "./core/Clock.js";
import { Store } from "./core/Store.js";
import { AudioEngine } from "./core/AudioEngine.js";
import { GrooveController } from "./core/GrooveController.js";
import { Grid } from "./components/Grid.js";
import { Dial } from "./components/Dial.js";
import { RiveAvatar } from "./components/RiveAvatar.js";
import { SampleUploader } from "./components/SampleUploader.js";
import { BulkDropZone } from "./components/BulkDropZone.js";
import { Toast } from "./components/Toast.js";
import { NUM_TRACKS, NUM_STEPS} from './constants/drums.js'

export default function Init() {
  // Initialize core modules
  const APP_STORE = new Store();
  const audioCtx = new window.AudioContext();
  const AUDIO_ENGINE = new AudioEngine(audioCtx);

  // Initialize UI components
  const GRID = new Grid(APP_STORE, "#app");
  GRID.init();

 for (let track = 0; track < NUM_TRACKS;track++) {
  new SampleUploader(
    audioCtx,
    AUDIO_ENGINE,
    track,
    `.sample-drop-zone[data-track="${track}"]`
  )
 }

  // Initialize bulk drop zone for multi-file upload
  new BulkDropZone(audioCtx, AUDIO_ENGINE, '#app');

  new Dial(APP_STORE, "#humanize-container");

  const Avatar = new RiveAvatar("#avatar-canvas");
  Avatar.init();


  // Initialize tempo input
  const tempoElem = document.querySelector("#tempo-input");
  tempoElem.value = APP_STORE.getState().transport.bpm;

  // Initialize groove controller (handles AI worker and humanization)
  const GROOVE_CONTROLLER = new GrooveController(APP_STORE, AUDIO_ENGINE);
  GROOVE_CONTROLLER.init();

  // Initialize clock with groove controller callback
  const CLOCK = new Clock({
    audioContext: audioCtx,
    getTempo: () => APP_STORE.getState().transport.bpm,
    onTick: (step, time) => {
      GROOVE_CONTROLLER.handleTick(step, time);
      GRID.updatePlayhead(step);
    },
  });

  // Tempo input handler
  document.querySelector("#tempo-input").addEventListener("change", (e) => {
    e.preventDefault();
    const currentTempo = APP_STORE.getState().transport.bpm;
    const tempoVal = parseFloat(Number.parseFloat(e.target.value).toFixed(2));
    if (tempoVal === 0 || Number.isNaN(tempoVal)) {
      e.target.value = currentTempo;
    } else {
      APP_STORE.dispatch({
        type: "SET_TEMPO",
        payload: tempoVal,
      });

      // Update animation speed based on new BPM
      window.dispatchEvent(new CustomEvent('bpm-update', {
        detail: { bpm: tempoVal }
      }));
    }
  });

  // Fire initial BPM event to set animation speed
  window.dispatchEvent(new CustomEvent('bpm-update', {
    detail: { bpm: APP_STORE.getState().transport.bpm }
  }));

  // Clear pattern button handler
  document.querySelector("#clear-btn").addEventListener("click", () => {
    APP_STORE.dispatch({ type: "RESET_STEPS" });
  });

  // Reset samples button handler
  const resetSamplesBtn = document.querySelector("#reset-samples-btn");

  // Update button state based on custom samples
  const updateResetBtnState = () => {
    const hasCustom = AUDIO_ENGINE.customSamples.size > 0;
    resetSamplesBtn.classList.toggle('has-custom', hasCustom);
  };

  // Listen for custom sample changes
  window.addEventListener('sample-replaced', updateResetBtnState);

  resetSamplesBtn.addEventListener("click", () => {
    if (AUDIO_ENGINE.customSamples.size === 0) {
      Toast.show("No custom samples to reset", "info");
      return;
    }

    AUDIO_ENGINE.resetSamples();
    updateResetBtnState();
    Toast.show("Samples restored to defaults", "success");
  });

  // Hi-hat mode toggle handler
  const hihatToggle = document.querySelector("#hihat-mode-toggle");
  if (hihatToggle) {
    hihatToggle.addEventListener("click", (e) => {
      const modeBtn = e.target.closest(".mode-btn");
      if (!modeBtn) return;

      const mode = modeBtn.dataset.mode;
      APP_STORE.dispatch({ type: "SET_HIHAT_MODE", payload: mode });

      // Update button active states
      hihatToggle.querySelectorAll(".mode-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.mode === mode);
      });
    });
  }

  // Play button handler
  const playBtn = document.querySelector("#play-btn");

  playBtn.addEventListener("click", async () => {
    const isPlaying = APP_STORE.getState().transport.isPlaying;

    APP_STORE.dispatch({
      type: "TOGGLE_PLAY",
    });

    if (isPlaying) {
      CLOCK.stop();
      Avatar.pause();
      playBtn.textContent = "Start Sequencer";
    } else {
      // Wake up the audio context (browsers suspend it by default)
      await audioCtx.resume();
      console.log("Audio Context Resumed");

      // Load drum samples (only loads once, subsequent calls are no-op)
      await AUDIO_ENGINE.loadSamples();

      // Start the Clock and Avatar animation
      CLOCK.start();
      Avatar.play();
      playBtn.textContent = "Stop Sequencer";
    }
  });
}

Init();
