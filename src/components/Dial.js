export class Dial {
  constructor(store, containerSelector, label = "Humanize") {
    this.store = store;
    this.container = document.querySelector(containerSelector);
    this.label = label;

    // Get the initial value from the store
    this.state = this.store.getState();
    this.value = this.state.humanizeValue || 0;

    this.size = 100;
    this.center = this.size / 2;
    this.radius = 38;

    // Vertical drag tracking
    this.startY = 0;
    this.startValue = 0;
    this.sensitivity = 0.5; // Value change per pixel dragged

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
      <div class="dial-wrapper">
        <label class="dial-label">${this.label}</label>
        <div class="dial-container">
          <svg viewBox="0 0 ${this.size} ${this.size}" class="dial-svg">
            <defs>
              <!-- TR-909 Knob gradient - dark charcoal -->
              <linearGradient id="tr909KnobGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#5a5a5a"/>
                <stop offset="15%" style="stop-color:#4a4a4a"/>
                <stop offset="50%" style="stop-color:#3a3a3a"/>
                <stop offset="85%" style="stop-color:#2a2a2a"/>
                <stop offset="100%" style="stop-color:#222"/>
              </linearGradient>

              <!-- Highlight for 3D effect -->
              <linearGradient id="tr909Highlight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#666"/>
                <stop offset="50%" style="stop-color:#444"/>
                <stop offset="100%" style="stop-color:#333"/>
              </linearGradient>

              <!-- Inner shadow -->
              <radialGradient id="tr909InnerShadow" cx="50%" cy="30%" r="60%">
                <stop offset="0%" style="stop-color:#4a4a4a"/>
                <stop offset="100%" style="stop-color:#1a1a1a"/>
              </radialGradient>

              <!-- Glow filter for active indicator -->
              <filter id="tr909Glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>

              <!-- Drop shadow for knob -->
              <filter id="tr909Shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/>
              </filter>
            </defs>

            <!-- Outer bezel ring - silver/gray like TR-909 faceplate -->
            <circle cx="${this.center}" cy="${this.center}" r="46" fill="#888" stroke="#666" stroke-width="1"/>
            <circle cx="${this.center}" cy="${this.center}" r="44" fill="#777" stroke="#555" stroke-width="1"/>

            <!-- Track background (notched area) -->
            <path
              d="${this.getArcPath(38, -135, 135)}"
              fill="none"
              stroke="#333"
              stroke-width="6"
              stroke-linecap="round"
            />

            <!-- Value track (inactive) -->
            <path
              d="${this.getArcPath(38, -135, 135)}"
              fill="none"
              stroke="#444"
              stroke-width="4"
              stroke-linecap="round"
            />

            <!-- Value track (active glow) - TR-909 Orange -->
            <path
              class="dial-glow"
              d="${this.getArcPath(38, -135, 135)}"
              fill="none"
              stroke="#ff6a00"
              stroke-width="4"
              stroke-linecap="round"
              stroke-dasharray="180"
              stroke-dashoffset="180"
              filter="url(#tr909Glow)"
            />

            <!-- Tick marks -->
            ${this.renderTickMarks()}

            <!-- Knob body with shadow -->
            <g class="knob-group" filter="url(#tr909Shadow)">
              <!-- Outer knob rim -->
              <circle cx="${this.center}" cy="${this.center}" r="32" fill="#222"/>

              <!-- Main knob body -->
              <circle cx="${this.center}" cy="${this.center}" r="29" fill="url(#tr909KnobGradient)"/>

              <!-- Knob highlight (top edge) -->
              <ellipse cx="${this.center}" cy="${this.center - 6}" rx="20" ry="12" fill="url(#tr909Highlight)" opacity="0.25"/>

              <!-- Grip ridges - concentric rings -->
              <circle cx="${this.center}" cy="${this.center}" r="24" fill="none" stroke="#555" stroke-width="0.5"/>
              <circle cx="${this.center}" cy="${this.center}" r="20" fill="none" stroke="#555" stroke-width="0.5"/>
              <circle cx="${this.center}" cy="${this.center}" r="16" fill="none" stroke="#555" stroke-width="0.5"/>

              <!-- Center cap -->
              <circle cx="${this.center}" cy="${this.center}" r="8" fill="url(#tr909InnerShadow)" stroke="#333" stroke-width="1"/>

              <!-- Pointer/indicator line - TR-909 Orange -->
              <line
                class="dial-pointer"
                x1="${this.center}" y1="${this.center - 25}"
                x2="${this.center}" y2="${this.center - 14}"
                stroke="#ff6a00"
                stroke-width="3"
                stroke-linecap="round"
                filter="url(#tr909Glow)"
              />
            </g>
          </svg>
          <div class="dial-value">${this.value}%</div>
        </div>
      </div>
      <style>
        .dial-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          user-select: none;
        }
        .dial-label {
          color: #ff6a00;
          font-family: 'Arial', sans-serif;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 2px;
          font-weight: bold;
        }
        .dial-container {
          position: relative;
          width: 100px;
          height: 100px;
        }
        .dial-svg {
          cursor: ns-resize;
          width: 100%;
          height: 100%;
        }
        .dial-svg:active {
          cursor: grabbing;
        }
        .knob-group {
          transform-origin: ${this.center}px ${this.center}px;
          transition: transform 0.05s ease-out;
        }
        .dial-value {
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          color: #ff6a00;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          font-weight: bold;
          text-shadow: 0 0 6px rgba(255, 106, 0, 0.4);
        }
        .dial-glow {
          transition: stroke-dashoffset 0.05s ease-out;
        }
      </style>
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

  renderTickMarks() {
    const ticks = [];
    const numTicks = 11; // 0, 10, 20, ... 100
    const startAngle = -135;
    const endAngle = 135;
    const angleRange = endAngle - startAngle;

    for (let i = 0; i < numTicks; i++) {
      const angle = startAngle + (i / (numTicks - 1)) * angleRange;
      const radian = (angle * Math.PI) / 180;

      const innerRadius = 40;
      const outerRadius = i % 5 === 0 ? 46 : 43; // Longer ticks at 0, 50, 100

      const x1 = this.center + innerRadius * Math.cos(radian);
      const y1 = this.center + innerRadius * Math.sin(radian);
      const x2 = this.center + outerRadius * Math.cos(radian);
      const y2 = this.center + outerRadius * Math.sin(radian);

      const strokeWidth = i % 5 === 0 ? 2 : 1;
      const color = i % 5 === 0 ? '#555' : '#444';

      ticks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${strokeWidth}"/>`);
    }

    return ticks.join('');
  }

  setupListeners() {
    const svg = this.container.querySelector('.dial-svg');

    svg.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.isDragging = true;
      this.startY = e.clientY;
      this.startValue = this.value;

      // Change cursor globally during drag
      document.body.style.cursor = 'ns-resize';

      window.addEventListener("mousemove", this.handleMouseMove);
      window.addEventListener("mouseup", this.handleMouseUp);
    });

    // Double-click to reset to 0
    svg.addEventListener("dblclick", () => {
      this.value = 0;
      this.updateVisuals();
      this.store.dispatch({
        type: "SET_HUMANIZE",
        payload: this.value,
      });
      window.dispatchEvent(new CustomEvent('dial-update', {
        detail: { intensity: this.value }
      }));
    });
  }

  updateVisuals() {
    // Calculate the rotation for the knob (-135 to +135 degrees)
    const rotation = -135 + (this.value / 100) * 270;

    // Rotate the knob group
    const knob = this.container.querySelector(".knob-group");
    if (knob) {
      knob.style.transform = `rotate(${rotation}deg)`;
    }

    // Update the glow arc
    const glow = this.container.querySelector(".dial-glow");
    if (glow) {
      const totalLength = 180;
      const offset = totalLength - (this.value / 100) * totalLength;
      glow.style.strokeDashoffset = offset;
    }

    // Update the value display
    const valueDisplay = this.container.querySelector(".dial-value");
    if (valueDisplay) {
      valueDisplay.textContent = `${this.value}%`;
    }
  }

  subscribe() {
    this.store.subscribe((newState) => {
      this.value = newState.humanizeValue;
      this.updateVisuals();
    });
  }

  handleMouseMove(e) {
    if (!this.isDragging) return;

    // Calculate vertical delta (inverted: drag up = increase)
    const deltaY = this.startY - e.clientY;

    // Apply sensitivity and calculate new value
    const deltaValue = deltaY * this.sensitivity;
    let newValue = this.startValue + deltaValue;

    // Clamp to 0-100
    newValue = Math.max(0, Math.min(100, Math.round(newValue)));

    // Only update if value changed
    if (newValue !== this.value) {
      this.value = newValue;
      this.updateVisuals();

      // Dispatch fast event for real-time Rive updates
      window.dispatchEvent(new CustomEvent('dial-update', {
        detail: { intensity: this.value }
      }));
    }
  }

  handleMouseUp() {
    this.isDragging = false;
    document.body.style.cursor = '';

    // Finalize the change in the Global Store
    this.store.dispatch({
      type: "SET_HUMANIZE",
      payload: this.value,
    });

    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  }
}
