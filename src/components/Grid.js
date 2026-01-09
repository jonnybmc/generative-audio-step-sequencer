import { NUM_TRACKS, NUM_STEPS } from '../constants/drums.js';

export class Grid {
  constructor(store, targetDOMElem) {
    this.store = store;
    this.state = store.getState();
    this.rootElem = targetDOMElem;
    this.previousSteps = null; // Track previous state for diff updates
    this.stepElements = {}; // Cache DOM references
  }

  init() {
    let htmlRootElem = document.querySelector(this.rootElem);
    this.rootElem = htmlRootElem;
    this.rootElem.addEventListener("click", (e) => {
      if (e.target.classList.contains("step")) {
        this.store.dispatch({
          type: "TOGGLE",
          payload: e.target.id,
        });
      }
    });
    this.initialRender(this.state);
    this.subscribe();
  }

  subscribe() {
    // Use selector-based subscription to only update when steps change
    this.store.subscribeToSelector(
      state => state.steps,
      (newSteps) => this.updateSteps(newSteps)
    );
  }

  updatePlayhead(currentStepIndex) {
    // Remove all current playing classes
    const currentlyPlayingSteps = this.rootElem.querySelectorAll(".playing");
    currentlyPlayingSteps.forEach((step) => {
      step.classList.remove("playing");
    });

    // Light up each column at the given currentStepIndex
    for (let i = 0; i < NUM_TRACKS; i++) {
      const stepId = `track-${i}_${currentStepIndex}`;
      const elem = this.stepElements[stepId];
      if (elem) {
        elem.classList.add("playing");
      }
    }
  }

  /**
   * Initial render - creates all DOM elements and caches references
   */
  initialRender(state) {
    const steps = Object.values(state.steps);
    const HTMLNodes = steps.map((step) => {
      return `<div class="step ${step.active ? "active" : ""}" id="${step.id}"></div>`;
    });
    this.rootElem.innerHTML = HTMLNodes.join(" ");

    // Cache DOM references for efficient updates
    steps.forEach((step) => {
      this.stepElements[step.id] = document.getElementById(step.id);
    });

    this.previousSteps = state.steps;
  }

  /**
   * Diff-based update - only updates changed steps
   */
  updateSteps(newSteps) {
    if (!this.previousSteps) {
      return;
    }

    // Find and update only changed steps
    Object.keys(newSteps).forEach((stepId) => {
      const newStep = newSteps[stepId];
      const oldStep = this.previousSteps[stepId];

      // Only update if active state changed
      if (oldStep && newStep.active !== oldStep.active) {
        const elem = this.stepElements[stepId];
        if (elem) {
          elem.classList.toggle("active", newStep.active);
        }
      }
    });

    this.previousSteps = newSteps;
  }
}
