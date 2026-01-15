/**
 * MiniDial Component
 * Compact dial for per-track ghost quantity control (~40px)
 * TR-909 inspired styling, vertical drag interaction
 */

export class MiniDial {
  constructor(options) {
    this.store = options.store;
    this.track = options.track;
    this.container = options.container;
    this.label = options.label || 'Ghost';

    // Get initial value from store
    const state = this.store.getState();
    this.value = state.trackSettings[this.track]?.ghostQuantity || 0;

    this.size = 36;
    this.center = this.size / 2;

    // Vertical drag tracking
    this.isDragging = false;
    this.startY = 0;
    this.startValue = 0;
    this.sensitivity = 0.8;

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);

    this.init();
  }

  init() {
    this.render();
    this.updateVisuals();
    this.setupListeners();
    this.subscribe();
  }

  render() {
    const html = `
      <div class="mini-dial-wrapper" data-track="${this.track}">
        <svg viewBox="0 0 ${this.size} ${this.size}" class="mini-dial-svg">
          <defs>
            <linearGradient id="miniKnobGradient${this.track}" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#5a5a5a"/>
              <stop offset="50%" style="stop-color:#3a3a3a"/>
              <stop offset="100%" style="stop-color:#222"/>
            </linearGradient>
            <filter id="miniGlow${this.track}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <!-- Outer ring -->
          <circle cx="${this.center}" cy="${this.center}" r="17" fill="#555" stroke="#444" stroke-width="1"/>

          <!-- Track arc (background) -->
          <path
            d="${this.getArcPath(14, -135, 135)}"
            fill="none"
            stroke="#333"
            stroke-width="3"
            stroke-linecap="round"
          />

          <!-- Value arc (active) -->
          <path
            class="mini-dial-arc"
            d="${this.getArcPath(14, -135, 135)}"
            fill="none"
            stroke="#ff6a00"
            stroke-width="3"
            stroke-linecap="round"
            stroke-dasharray="70"
            stroke-dashoffset="70"
            filter="url(#miniGlow${this.track})"
          />

          <!-- Knob body -->
          <g class="mini-knob-group">
            <circle cx="${this.center}" cy="${this.center}" r="12" fill="url(#miniKnobGradient${this.track})"/>
            <circle cx="${this.center}" cy="${this.center}" r="10" fill="none" stroke="#555" stroke-width="0.5"/>

            <!-- Pointer -->
            <line
              class="mini-dial-pointer"
              x1="${this.center}" y1="${this.center - 9}"
              x2="${this.center}" y2="${this.center - 5}"
              stroke="#ff6a00"
              stroke-width="2"
              stroke-linecap="round"
            />
          </g>
        </svg>
        <span class="mini-dial-label">${this.label}</span>
      </div>
    `;
    this.container.innerHTML = html;
  }

  getArcPath(radius, startAngle, endAngle) {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = this.center + radius * Math.cos(startRad);
    const y1 = this.center + radius * Math.sin(startRad);
    const x2 = this.center + radius * Math.cos(endRad);
    const y2 = this.center + radius * Math.sin(endRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  setupListeners() {
    const svg = this.container.querySelector('.mini-dial-svg');

    svg.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDragging = true;
      this.startY = e.clientY;
      this.startValue = this.value;

      document.body.style.cursor = 'ns-resize';

      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('mouseup', this.handleMouseUp);
    });

    // Double-click to reset
    svg.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.value = 0;
      this.updateVisuals();
      this.dispatchChange();
    });
  }

  handleMouseMove(e) {
    if (!this.isDragging) return;

    const deltaY = this.startY - e.clientY;
    const deltaValue = deltaY * this.sensitivity;
    let newValue = this.startValue + deltaValue;

    newValue = Math.max(0, Math.min(100, Math.round(newValue)));

    if (newValue !== this.value) {
      this.value = newValue;
      this.updateVisuals();
    }
  }

  handleMouseUp() {
    this.isDragging = false;
    document.body.style.cursor = '';

    this.dispatchChange();

    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  dispatchChange() {
    this.store.dispatch({
      type: 'SET_TRACK_GHOST_QUANTITY',
      payload: { track: this.track, value: this.value }
    });
  }

  updateVisuals() {
    const rotation = -135 + (this.value / 100) * 270;

    const knob = this.container.querySelector('.mini-knob-group');
    if (knob) {
      knob.style.transform = `rotate(${rotation}deg)`;
      knob.style.transformOrigin = `${this.center}px ${this.center}px`;
    }

    const arc = this.container.querySelector('.mini-dial-arc');
    if (arc) {
      const totalLength = 70;
      const offset = totalLength - (this.value / 100) * totalLength;
      arc.style.strokeDashoffset = offset;
    }
  }

  subscribe() {
    this.store.subscribe((newState) => {
      const newValue = newState.trackSettings[this.track]?.ghostQuantity || 0;
      if (newValue !== this.value) {
        this.value = newValue;
        this.updateVisuals();
      }
    });
  }
}
