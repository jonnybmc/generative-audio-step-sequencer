/**
 * Groove Controller
 * Manages AI groove worker communication and state
 * Handles humanization and ghost note generation coordination
 */

import { WORKER_MESSAGES } from '../constants/workerMessages.js';
import { TRACK_TO_PITCH } from '../constants/drums.js';

export class GrooveController {
  constructor(store, audioEngine) {
    this.store = store;
    this.audioEngine = audioEngine;
    this.currentAISequence = null;
    this.currentGhostNotes = [];
    this.worker = null;
    this.unsubscribers = [];
  }

  /**
   * Initialize the groove controller
   * Sets up worker and state subscriptions
   */
  init() {
    // Create worker
    this.worker = new Worker(
      new URL('../workers/grooveWorker.js', import.meta.url)
    );

    // Set up worker message handling
    this.worker.onmessage = (e) => this.handleWorkerMessage(e);

    // Subscribe to relevant state changes
    this.setupSubscriptions();
  }

  /**
   * Set up store subscriptions for groove-related state changes
   */
  setupSubscriptions() {
    // Track previous values for change detection
    let lastSteps = this.store.getState().steps;
    let lastHumanize = this.store.getState().humanizeValue;
    let lastBpm = this.store.getState().transport.bpm;
    let lastTrackSettings = this.store.getState().trackSettings;

    const unsubscribe = this.store.subscribe(newState => {
      const stepsChanged = newState.steps !== lastSteps;
      const humanizeChanged = newState.humanizeValue !== lastHumanize;
      const bpmChanged = newState.transport.bpm !== lastBpm;
      const trackSettingsChanged = newState.trackSettings !== lastTrackSettings;

      // Refresh AI groove when pattern, dial, or tempo changes
      if (stepsChanged || humanizeChanged || bpmChanged) {
        console.log("Change detected! Refreshing AI groove...");
        this.requestHumanize();
      }

      // Refresh ghost notes when track settings change (separate from AI groove)
      if (trackSettingsChanged && this.currentAISequence) {
        console.log("Track settings changed! Refreshing ghost notes...");
        this.refreshGhostNotes();
      }

      // Update trackers
      lastSteps = newState.steps;
      lastHumanize = newState.humanizeValue;
      lastBpm = newState.transport.bpm;
      lastTrackSettings = newState.trackSettings;
    });

    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Handle messages from the groove worker
   */
  handleWorkerMessage(e) {
    switch (e.data.type) {
      case WORKER_MESSAGES.READY:
        // Worker is initialized - send initial pattern
        this.requestHumanize();
        break;

      case WORKER_MESSAGES.HUMANIZED_RESULT:
        this.currentAISequence = e.data.payload;
        this.refreshGhostNotes();

        if (this.currentGhostNotes.length > 0) {
          console.log(`Ghost notes: ${this.currentGhostNotes.length} ghosts added`);
        }
        break;
    }
    console.log("main thread message received", e.data);
  }

  /**
   * Request humanization from worker
   */
  requestHumanize() {
    const state = this.store.getState();
    this.worker.postMessage({
      type: WORKER_MESSAGES.HUMANIZE,
      payload: {
        bpm: state.transport.bpm,
        steps: state.steps,
        humanizeValue: state.humanizeValue
      }
    });
  }

  /**
   * Refresh ghost notes based on current AI sequence and state
   */
  refreshGhostNotes() {
    const state = this.store.getState();
    const humanizeAmount = state.humanizeValue / 100;

    this.currentGhostNotes = this.audioEngine.extractGhostNotes(
      this.currentAISequence,
      state.steps,
      state.transport.bpm,
      humanizeAmount,
      state.trackSettings
    );
  }

  /**
   * Get current AI sequence
   * @returns {Object|null}
   */
  getAISequence() {
    return this.currentAISequence;
  }

  /**
   * Get current ghost notes
   * @returns {Array}
   */
  getGhostNotes() {
    return this.currentGhostNotes;
  }

  /**
   * Handle a clock tick - plays notes for the current step
   * @param {number} currentStep - Current sequencer step (0-15)
   * @param {number} nextNoteTime - AudioContext time for the next note
   */
  handleTick(currentStep, nextNoteTime) {
    const state = this.store.getState();
    const humanizeAmount = state.humanizeValue / 100;
    const bpm = state.transport.bpm;
    const trackSettings = state.trackSettings;
    const stepDuration = (60 / bpm) / 4;

    // 1. Play the main pattern notes (kick, snare, hihats)
    [0, 1, 2, 3].forEach((trackIndex) => {
      const id = `track-${trackIndex}_${currentStep}`;
      if (state.steps[id].active) {
        const { time, velocity } = this.audioEngine.getHumanizedNote(
          trackIndex,
          currentStep,
          nextNoteTime,
          this.currentAISequence,
          humanizeAmount,
          TRACK_TO_PITCH,
          bpm,
          trackSettings
        );
        this.audioEngine.scheduleNote(time, TRACK_TO_PITCH[trackIndex], velocity);
      }
    });

    // 2. Play ghost notes for this step
    if (this.currentGhostNotes.length > 0) {
      const ghostsForThisStep = this.currentGhostNotes.filter(g => g.step === currentStep);
      ghostsForThisStep.forEach(ghost => {
        const expectedGridTime = ghost.step * stepDuration;
        const ghostOffset = ghost.startTime - expectedGridTime;
        const ghostTime = nextNoteTime + (ghostOffset * humanizeAmount);

        this.audioEngine.scheduleNote(ghostTime, ghost.pitch, ghost.velocity);
      });
    }
  }

  /**
   * Cleanup - unsubscribe from store and terminate worker
   */
  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
    if (this.worker) {
      this.worker.terminate();
    }
  }
}
