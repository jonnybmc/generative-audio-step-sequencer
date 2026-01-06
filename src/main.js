import { Clock } from "./core/Clock.js"; // Added .js
import { Store } from "./core/Store.js"; // Added .js
import { AudioEngine } from "./core/AudioEngine.js"; // Added .js
import { Grid } from "./components/Grid.js"; // Added .js
import { Dial } from "./components/Dial.js";

const NOTE_PITCHES = { 0: 36, 1: 38, 2: 42, 3: 46 };

export default function Init() {
  let APP_STORE = new Store();
  let audioCtx = new window.AudioContext();
  let AUDIO_ENGINE = new AudioEngine(audioCtx);
  let GRID = new Grid(APP_STORE, "#app");
  GRID.init();

  new Dial(APP_STORE, "#humanize-container");


  let tempoElem = document.querySelector("#tempo-input");
  tempoElem.value = APP_STORE.getState().transport.bpm;

  let grooveWorker = new Worker(
    new URL("./workers/grooveWorker.js", import.meta.url)
  );
  let currentAISequence = null;
  let currentGhostNotes = []; // Ghost notes extracted from AI sequence

  let CLOCK = new Clock({
    audioContext: audioCtx,
    getTempo: () => APP_STORE.getState().transport.bpm,
    onTick: (step, time) => {
      handleOnTick(step, time);
    },
  });

  // 1. Initialize your trackers
let lastSteps = APP_STORE.getState().steps;
let lastHumanize = APP_STORE.getState().humanizeValue;
let lastBpm = APP_STORE.getState().transport.bpm;

APP_STORE.subscribe(newState => {
  // 2. Check if pattern, dial, OR tempo changed
  const stepsChanged = newState.steps !== lastSteps;
  const humanizeChanged = newState.humanizeValue !== lastHumanize;
  const bpmChanged = newState.transport.bpm !== lastBpm;

  if (stepsChanged || humanizeChanged || bpmChanged) {
    console.log("Change detected! Refreshing AI groove...");

    grooveWorker.postMessage({
      type: 'HUMANIZE',
      payload: {
        bpm: newState.transport.bpm,
        steps: newState.steps,
        humanizeValue: newState.humanizeValue
      }
    });

    // 3. Update trackers to current state
    lastSteps = newState.steps;
    lastHumanize = newState.humanizeValue;
    lastBpm = newState.transport.bpm;
  }
});

  function handleOnTick(currentStep, nextNoteTime) {
    let steps = APP_STORE.getState().steps;
    const humanizeAmount = APP_STORE.getState().humanizeValue / 100; // 0.0 to 1.0
    const bpm = APP_STORE.getState().transport.bpm;
    const stepDuration = (60 / bpm) / 4;

    // 1. Play the main pattern notes (kick, snare, hihats)
    [0, 1, 2, 3].forEach((trackIndex) => {
      const id = `track-${trackIndex}_${currentStep}`;
      if (steps[id].active) {
        // Get humanized timing AND velocity from AI
        const { time, velocity } = AUDIO_ENGINE.getHumanizedNote(
          trackIndex,
          currentStep,
          nextNoteTime,
          currentAISequence,
          humanizeAmount,
          NOTE_PITCHES,
          bpm
        );
        AUDIO_ENGINE.scheduleNote(time, NOTE_PITCHES[trackIndex], velocity);
      }
    });

    // 2. Play ghost notes for this step (soft snare hits added by AI)
    if (currentGhostNotes.length > 0) {
      const ghostsForThisStep = currentGhostNotes.filter(g => g.step === currentStep);
      ghostsForThisStep.forEach(ghost => {
        // Calculate the ghost note time with its micro-timing offset
        const expectedGridTime = ghost.step * stepDuration;
        const ghostOffset = ghost.startTime - expectedGridTime;
        const ghostTime = nextNoteTime + (ghostOffset * humanizeAmount);

        AUDIO_ENGINE.scheduleNote(ghostTime, ghost.pitch, ghost.velocity);
      });
    }

    GRID.updatePlayhead(currentStep);
  }

  // --- NEW CODE BELOW ---
  // Wait for user interaction to start audio

  document.querySelector("#tempo-input").addEventListener("change", (e) => {
    e.preventDefault();
    let currentTempo = APP_STORE.getState().transport.bpm;
    let tempoVal = parseFloat(Number.parseFloat(e.target.value).toFixed(2));
    if (tempoVal === 0 || Number.isNaN(tempoVal)) {
      e.target.value = currentTempo;
    } else {
      APP_STORE.dispatch({
        type: "SET_TEMPO",
        payload: tempoVal,
      });
    }
  });

  document.querySelector("#play-btn").addEventListener("click", async () => {
    let isPlaying = APP_STORE.getState().transport.isPlaying;

    APP_STORE.dispatch({
      type: "TOGGLE_PLAY",
    });

    if (isPlaying) {
      CLOCK.stop();
    } else {
      // 1. Wake up the audio context (browsers suspend it by default)
      await audioCtx.resume();
      console.log("Audio Context Resumed");

      // 2. Load drum samples (only loads once, subsequent calls are no-op)
      await AUDIO_ENGINE.loadSamples();

      // 3. Start the Clock
      CLOCK.start();
    }
  });

  // document.querySelector("#humanize-dial").addEventListener("change", (e) => {
  //   const val = parseFloat(e.target.value);

  //   APP_STORE.dispatch({
  //     type: "SET_HUMANIZE",
  //     payload: val,
  //   });

  //   grooveWorker.postMessage({
  //     type: "HUMANIZE",
  //     payload: {
  //       bpm: APP_STORE.getState().transport.bpm,
  //       steps: APP_STORE.getState().steps,
  //     },
  //   });
  // });

  grooveWorker.onmessage = function (e) {
    switch (e.data.type) {
      case "READY":
        // Worker is initialized - send initial pattern to get AI sequence ready
        grooveWorker.postMessage({
          type: 'HUMANIZE',
          payload: {
            bpm: APP_STORE.getState().transport.bpm,
            steps: APP_STORE.getState().steps,
            humanizeValue: APP_STORE.getState().humanizeValue
          }
        });
        break;
      case "HUMANIZED_RESULT":
        const aiSequence = e.data.payload;
        currentAISequence = aiSequence;

        // Extract ghost notes from AI sequence
        const state = APP_STORE.getState();
        const humanizeAmount = state.humanizeValue / 100;
        currentGhostNotes = AUDIO_ENGINE.extractGhostNotes(
          aiSequence,
          state.steps,
          state.transport.bpm,
          humanizeAmount
        );

        if (currentGhostNotes.length > 0) {
          console.log(`Ghost hi-hats: ${currentGhostNotes.length} triplet/pocket fills added`);
        }
        break;
    }
    console.log("main thread message received", e.data);
  };
}

Init();
