import { Clock } from "./core/Clock.js";
import { Store } from "./core/Store.js";
import { AudioEngine } from "./core/AudioEngine.js";
import { GrooveController } from "./core/GrooveController.js";
import { Grid } from "./components/Grid.js";
import { Dial } from "./components/Dial.js";
import { TrackControls } from "./components/TrackControls.js";

export default function Init() {
  // Initialize core modules
  const APP_STORE = new Store();
  const audioCtx = new window.AudioContext();
  const AUDIO_ENGINE = new AudioEngine(audioCtx);

  // Initialize UI components
  const GRID = new Grid(APP_STORE, "#app");
  GRID.init();

  new Dial(APP_STORE, "#humanize-container");
  new TrackControls(APP_STORE, "#track-controls");

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
    }
  });

  // Play button handler
  document.querySelector("#play-btn").addEventListener("click", async () => {
    const isPlaying = APP_STORE.getState().transport.isPlaying;

    APP_STORE.dispatch({
      type: "TOGGLE_PLAY",
    });

    if (isPlaying) {
      CLOCK.stop();
    } else {
      // Wake up the audio context (browsers suspend it by default)
      await audioCtx.resume();
      console.log("Audio Context Resumed");

      // Load drum samples (only loads once, subsequent calls are no-op)
      await AUDIO_ENGINE.loadSamples();

      // Start the Clock
      CLOCK.start();
    }
  });
}

Init();
