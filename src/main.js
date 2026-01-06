import { Clock } from "./core/Clock.js"; // Added .js
import { Store } from "./core/Store.js"; // Added .js
import { AudioEngine } from "./core/AudioEngine.js"; // Added .js
import { Grid } from "./components/Grid.js"; // Added .js

const NOTE_PITCHES = [261.63, 293.66, 329.63, 349.23];

export default function Init() {
  let APP_STORE = new Store();
  let audioCtx = new window.AudioContext();
  let AUDIO_ENGINE = new AudioEngine(audioCtx);
  let GRID = new Grid(APP_STORE, "#app");
  GRID.init();
  let tempoElem =  document.querySelector("#tempo-input");
  tempoElem.value = APP_STORE.getState().transport.bpm
  

  let CLOCK = new Clock({
    audioContext: audioCtx,
    getTempo: () => APP_STORE.getState().transport.bpm,
    onTick: (step, time) => {
      handleOnTick(step, time);
    },
  });

  function handleOnTick(currentStep, nextNoteTime) {
    let steps = APP_STORE.getState().steps;
    [0, 1, 2, 3].forEach((track, index) => {
      const id = `track-${index}_${currentStep}`;
      if (steps[id].active) {
        AUDIO_ENGINE.scheduleNote(nextNoteTime, NOTE_PITCHES[index]);
      }
    });

    GRID.updatePlayhead(currentStep);
  }

  // --- NEW CODE BELOW ---
  // Wait for user interaction to start audio

  document.querySelector("#tempo-input").addEventListener("change", (e) => {
    e.preventDefault();
    let currentTempo = APP_STORE.getState().transport.bpm
    let tempoVal = parseFloat(Number.parseFloat(e.target.value).toFixed(2));
    if (tempoVal === 0 || Number.isNaN(tempoVal)) {
        e.target.value = currentTempo
    } else {
      APP_STORE.dispatch({
        type: "SET_TEMPO",
        payload: tempoVal,
      });
    }
  });

  document.querySelector("#play-btn").addEventListener("click", () => {
    let isPlaying = APP_STORE.getState().transport.isPlaying;

    APP_STORE.dispatch({
      type: "TOGGLE_PLAY",
    });

    if (isPlaying) {
        CLOCK.stop();
    } else {
        // 1. Wake up the audio context (browsers suspend it by default)
    audioCtx.resume().then(() => {
      console.log("Audio Context Resumed");
      // 2. Start the Clock
      CLOCK.start();
    });
    }  
  });
}

Init();
