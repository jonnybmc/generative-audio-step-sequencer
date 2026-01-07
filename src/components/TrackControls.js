export class TrackControls {
  constructor(store, containerSelector) {
    this.store = store;
    this.container = document.querySelector(containerSelector);

    // Track names for display
    this.trackNames = {
      0: 'KICK',
      1: 'SNARE',
      2: 'HI-HAT',
      3: 'OPEN HH'
    };

    this.init();
  }

  init() {
    this.render();
    this.setupListeners();
    this.subscribe();
  }

  /**
   * Calculate effective humanize for a track
   * Effective = Main dial × Track multiplier
   */
  getEffectiveHumanize(mainHumanize, trackMultiplier, swingEnabled) {
    if (!swingEnabled) return 0;
    return Math.round(mainHumanize * (trackMultiplier / 100));
  }

  render() {
    const state = this.store.getState();
    const trackSettings = state.trackSettings;
    const mainHumanize = state.humanizeValue;

    let tracksHtml = '';
    for (let track = 0; track < 4; track++) {
      const settings = trackSettings[track];
      tracksHtml += this.renderTrackRow(track, settings, mainHumanize);
    }

    const html = `
      <h3>Track Groove</h3>
      ${tracksHtml}
    `;
    this.container.innerHTML = html;
  }

  renderTrackRow(track, settings, mainHumanize) {
    const swingChecked = settings.swingEnabled ? 'checked' : '';
    const swingClass = settings.swingEnabled ? 'enabled' : '';
    const ghostsChecked = settings.ghostsEnabled ? 'checked' : '';
    const ghostsClass = settings.ghostsEnabled ? 'enabled' : '';

    const effective = this.getEffectiveHumanize(mainHumanize, settings.humanize, settings.swingEnabled);
    const isBypassed = !settings.swingEnabled;

    // Only show effective when it provides useful info:
    // Main > 0 AND track is reduced from 100% AND swing is enabled
    const showEffective = mainHumanize > 0 && settings.humanize < 100 && settings.swingEnabled;

    return `
      <div class="track-control ${isBypassed ? 'bypassed' : ''}" data-track="${track}">
        <span class="track-label">${this.trackNames[track]}</span>
        <div class="track-slider-group">
          <input
            type="range"
            class="track-humanize"
            min="0"
            max="100"
            value="${settings.humanize}"
            data-track="${track}"
            ${isBypassed ? 'disabled' : ''}
          >
          <span class="track-value">${settings.humanize}%</span>
          <span class="track-effective ${showEffective ? 'show' : ''}">${showEffective ? `→ ${effective}%` : ''}</span>
        </div>
        <label class="track-toggle ${swingClass}" title="Enable/disable groove timing">
          <input type="checkbox" class="swing-toggle" data-track="${track}" ${swingChecked}>
          Swing
        </label>
        <label class="track-toggle ${ghostsClass}" title="Enable/disable ghost notes">
          <input type="checkbox" class="ghost-toggle" data-track="${track}" ${ghostsChecked}>
          Ghosts
        </label>
      </div>
    `;
  }

  setupListeners() {
    // Humanize sliders
    this.container.querySelectorAll('.track-humanize').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const track = parseInt(e.target.dataset.track);
        const value = parseInt(e.target.value);

        // Update display immediately
        const valueSpan = e.target.nextElementSibling;
        if (valueSpan) {
          valueSpan.textContent = `${value}%`;
        }
      });

      slider.addEventListener('change', (e) => {
        const track = parseInt(e.target.dataset.track);
        const value = parseInt(e.target.value);

        this.store.dispatch({
          type: 'SET_TRACK_HUMANIZE',
          payload: { track, value }
        });
      });
    });

    // Swing toggles
    this.container.querySelectorAll('.swing-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const track = parseInt(e.target.dataset.track);

        this.store.dispatch({
          type: 'TOGGLE_TRACK_SWING',
          payload: track
        });
      });
    });

    // Ghost toggles
    this.container.querySelectorAll('.ghost-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const track = parseInt(e.target.dataset.track);

        this.store.dispatch({
          type: 'TOGGLE_TRACK_GHOSTS',
          payload: track
        });
      });
    });
  }

  subscribe() {
    this.store.subscribe((newState) => {
      this.updateVisuals(newState.trackSettings, newState.humanizeValue);
    });
  }

  updateVisuals(trackSettings, mainHumanize) {
    for (let track = 0; track < 4; track++) {
      const settings = trackSettings[track];
      const row = this.container.querySelector(`.track-control[data-track="${track}"]`);
      if (!row) continue;

      const isBypassed = !settings.swingEnabled;
      const effective = this.getEffectiveHumanize(mainHumanize, settings.humanize, settings.swingEnabled);

      // Only show effective when it provides useful info
      const showEffective = mainHumanize > 0 && settings.humanize < 100 && settings.swingEnabled;

      // Update row bypassed state
      row.classList.toggle('bypassed', isBypassed);

      // Update humanize slider
      const slider = row.querySelector('.track-humanize');
      if (slider) {
        if (parseInt(slider.value) !== settings.humanize) {
          slider.value = settings.humanize;
        }
        slider.disabled = isBypassed;
      }

      // Update slider value display (always matches slider position)
      const valueSpan = row.querySelector('.track-value');
      if (valueSpan) {
        valueSpan.textContent = `${settings.humanize}%`;
      }

      // Update effective display (only when useful)
      const effectiveSpan = row.querySelector('.track-effective');
      if (effectiveSpan) {
        effectiveSpan.textContent = showEffective ? `→ ${effective}%` : '';
        effectiveSpan.classList.toggle('show', showEffective);
      }

      // Update swing toggle
      const swingCheckbox = row.querySelector('.swing-toggle');
      const swingLabel = swingCheckbox?.parentElement;
      if (swingCheckbox) {
        swingCheckbox.checked = settings.swingEnabled;
        swingLabel?.classList.toggle('enabled', settings.swingEnabled);
      }

      // Update ghost toggle
      const ghostCheckbox = row.querySelector('.ghost-toggle');
      const ghostLabel = ghostCheckbox?.parentElement;
      if (ghostCheckbox) {
        ghostCheckbox.checked = settings.ghostsEnabled;
        ghostLabel?.classList.toggle('enabled', settings.ghostsEnabled);
      }
    }
  }
}
