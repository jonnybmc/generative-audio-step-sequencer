import { NUM_TRACKS, NUM_STEPS } from '../constants/drums.js';
import { MiniDial } from './MiniDial.js';

const TRACK_NAMES = ['KICK', 'SNARE', 'HI-HAT', 'OPEN HH'];

// SVG lock icons
const LOCK_ICON_UNLOCKED = `<svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="5" y="11" width="14" height="10" rx="2" class="lock-body"/>
  <path d="M8 11V7a4 4 0 0 1 8 0" class="lock-shackle"/>
</svg>`;

const LOCK_ICON_LOCKED = `<svg class="lock-icon locked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="5" y="11" width="14" height="10" rx="2" class="lock-body"/>
  <path d="M8 11V7a4 4 0 0 1 8 0v4" class="lock-shackle"/>
</svg>`;

export class Grid {
  constructor(store, targetDOMElem) {
    this.store = store;
    this.state = store.getState();
    this.rootElem = targetDOMElem;
    this.previousSteps = null;
    this.stepElements = {};
    this.miniDials = [];
  }

  init() {
    let htmlRootElem = document.querySelector(this.rootElem);
    this.rootElem = htmlRootElem;

    this.rootElem.addEventListener("click", (e) => {
      // Handle step toggle
      if (e.target.classList.contains("step")) {
        this.store.dispatch({
          type: "TOGGLE",
          payload: e.target.id,
        });
        return;
      }

      // Handle swing lock toggle
      const lockBtn = e.target.closest(".swing-lock-btn");
      if (lockBtn) {
        const track = parseInt(lockBtn.dataset.track, 10);
        this.store.dispatch({
          type: "TOGGLE_TRACK_SWING_LOCK",
          payload: track,
        });
      }
    });

    this.initialRender(this.state);
    this.subscribe();
  }

  subscribe() {
    this.store.subscribeToSelector(
      state => state.steps,
      (newSteps) => this.updateSteps(newSteps)
    );

    // Subscribe to trackSettings changes for lock state updates
    this.store.subscribeToSelector(
      state => state.trackSettings,
      (newTrackSettings) => this.updateLockIcons(newTrackSettings)
    );
  }

  /**
   * Update lock icons when trackSettings change
   */
  updateLockIcons(trackSettings) {
    for (let track = 0; track < NUM_TRACKS; track++) {
      const lockBtn = this.rootElem.querySelector(`.swing-lock-btn[data-track="${track}"]`);
      if (lockBtn) {
        const isLocked = trackSettings?.[track]?.swingLocked ?? false;
        lockBtn.classList.toggle('locked', isLocked);
        lockBtn.innerHTML = isLocked ? LOCK_ICON_LOCKED : LOCK_ICON_UNLOCKED;
        lockBtn.title = isLocked ? 'Unlock swing' : 'Lock swing (stay on grid)';
      }
    }
  }

  updatePlayhead(currentStepIndex) {
    const currentlyPlayingSteps = this.rootElem.querySelectorAll(".playing");
    currentlyPlayingSteps.forEach((step) => {
      step.classList.remove("playing");
    });

    for (let i = 0; i < NUM_TRACKS; i++) {
      const stepId = `track-${i}_${currentStepIndex}`;
      const elem = this.stepElements[stepId];
      if (elem) {
        elem.classList.add("playing");
      }
    }
  }

  /**
   * Initial render - creates track rows with controls and steps
   */
  initialRender(state) {
    let rowsHtml = '';

    for (let track = 0; track < NUM_TRACKS; track++) {
      // Generate step buttons for this track
      let stepsHtml = '';
      for (let step = 0; step < NUM_STEPS; step++) {
        const stepId = `track-${track}_${step}`;
        const isActive = state.steps[stepId]?.active ? 'active' : '';
        stepsHtml += `<div class="step ${isActive}" id="${stepId}"></div>`;
      }

      // Check if swing is locked for this track
      const isSwingLocked = state.trackSettings?.[track]?.swingLocked ?? false;
      const lockIcon = isSwingLocked ? LOCK_ICON_LOCKED : LOCK_ICON_UNLOCKED;

      rowsHtml += `
        <div class="track-row" data-track="${track}">
          <div class="track-info">
            <span class="track-name">${TRACK_NAMES[track]}</span>
            <div class="track-controls-row">
              <button class="swing-lock-btn ${isSwingLocked ? 'locked' : ''}" data-track="${track}" title="${isSwingLocked ? 'Unlock swing' : 'Lock swing (stay on grid)'}">
                ${lockIcon}
              </button>
              <div class="track-dial-container" data-track="${track}"></div>
            </div>
          </div>
          <div class="track-steps">
            ${stepsHtml}
          </div>
        </div>
      `;
    }

    this.rootElem.innerHTML = rowsHtml;

    // Cache step element references
    for (let track = 0; track < NUM_TRACKS; track++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        const stepId = `track-${track}_${step}`;
        this.stepElements[stepId] = document.getElementById(stepId);
      }
    }

    // Initialize mini dials for each track
    this.miniDials = [];
    for (let track = 0; track < NUM_TRACKS; track++) {
      const dialContainer = this.rootElem.querySelector(`.track-dial-container[data-track="${track}"]`);
      if (dialContainer) {
        const miniDial = new MiniDial({
          store: this.store,
          track: track,
          container: dialContainer,
          label: 'Ghost'
        });
        this.miniDials.push(miniDial);
      }
    }

    this.previousSteps = state.steps;
  }

  /**
   * Diff-based update - only updates changed steps
   */
  updateSteps(newSteps) {
    if (!this.previousSteps) {
      return;
    }

    Object.keys(newSteps).forEach((stepId) => {
      const newStep = newSteps[stepId];
      const oldStep = this.previousSteps[stepId];

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
