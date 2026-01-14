export class Dial {
  constructor(store, containerSelector, label = "Humanize") {
    this.store = store;
    this.container = document.querySelector(containerSelector);
    this.label = label;

    // 1. Get the initial value from the store
    this.state = this.store.getState();
    this.value = this.state.humanizeValue || 0;

    this.size = 100;
    this.center = this.size / 2;
    this.radius = 35;

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);

    this.init();
  }

  init() {
    this.render();
    this.updateVisuals();
    this.setupListeners();
    this.subscribe()
  }

  render() {
    // Creating the SVG string with our layers
    const html = `
      <div class="dial-wrapper" style="width: 120px; text-align: center;">
        <label style="color: #ccc; font-family: sans-serif; font-size: 12px;">${this.label}</label>
        <svg viewBox="0 0 ${this.size} ${this.size}" style="cursor: pointer;">
          <path 
            d="M 25 80 A 35 35 0 1 1 75 80" 
            fill="none" 
            stroke="#222" 
            stroke-width="6" 
            stroke-linecap="round" 
          />
          <path 
            class="dial-glow"
            d="M 25 80 A 35 35 0 1 1 75 80" 
            fill="none" 
            stroke="#00ffcc" 
            stroke-width="6" 
            stroke-linecap="round"
            stroke-dasharray="165" 
            stroke-dashoffset="165"
          />
          <g class="knob-group" style="transform-origin: 50px 50px;">
            <circle cx="50" cy="50" r="28" fill="#333" stroke="#444" />
            <line x1="50" y1="22" x2="50" y2="35" stroke="#00ffcc" stroke-width="3" />
          </g>
        </svg>
      </div>
    `;
    this.container.innerHTML = html;
  }

  setupListeners() {
    this.container.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      // Activate global tracking
      window.addEventListener("mousemove", this.handleMouseMove);
      window.addEventListener("mouseup", this.handleMouseUp);
    });
  }

  updateVisuals() {
    // 1. Calculate the rotation for the knob
    const rotation = -135 + (this.value / 100) * 270;

    // 2. Find the knob group and rotate it
    const knob = this.container.querySelector(".knob-group");
    knob.style.transform = `rotate(${rotation}deg)`;

    // 3. Update the glow ring (the "light")
    const glow = this.container.querySelector(".dial-glow");
    const totalLength = 165; // This matches the stroke-dasharray in our SVG
    const offset = totalLength - (this.value / 100) * totalLength;
    glow.style.strokeDashoffset = offset;
  }

  subscribe() {
    this.store.subscribe((newState) => {
      // Update internal value and refresh visuals
      this.value = newState.humanizeValue;
      this.updateVisuals();
    });
  }

  handleMouseMove(e) {
    if (!this.isDragging) return;

    const rect = this.container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // 1. Calculate the angle in degrees
    let angle =
      (Math.atan2(e.pageY - centerY, e.pageX - centerX) * 180) / Math.PI;

    // 2. Normalize: Adjust so 7 o'clock is 0 degrees
    // (Adding 135 shifts our -135 start to 0)
    let normalizedAngle = angle + 135;
    if (normalizedAngle < 0) normalizedAngle += 360;

    // 3. Clamp: Limit to our 270-degree range
    if (normalizedAngle > 270) {
      // If in dead zone, snap to nearest end
      normalizedAngle = normalizedAngle > 315 ? 0 : 270;
    }

    // Update local value and visuals immediately
    this.value = Math.round((normalizedAngle / 270) * 100);
    this.updateVisuals();

    // we need to dispatch a custom event that will bypass the store and update the Rive 3d model in real time.
    const fastEvent = new CustomEvent(
      'dial-update', {
        detail: {
          intensity: this.value
        }
      });
    window.dispatchEvent(fastEvent);
  }

  handleMouseUp() {
    this.isDragging = false;

    // Finalize the change in the Global Store
    this.store.dispatch({
      type: "SET_HUMANIZE",
      payload: this.value,
    });

    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  }
}
