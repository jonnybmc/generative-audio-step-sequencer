// 📦 Load the whole module first
import * as riveModule from "@rive-app/canvas";

// 🛠 Unpack the tools.
// We check 'riveModule.default' (for CDNs that wrap it) OR 'riveModule' (for direct ESM)
const { Rive, Layout, Fit, Alignment } = riveModule.default || riveModule;

/**
 * Animation intensity tiers - easily extensible for more Rive states
 * Future: When adding more animations to the .riv file, add tiers here
 * The 1D blend state in Rive interpolates between states based on Intensity value
 *
 * Current setup:
 * - 0-25: Chill (Animation 1 dominant)
 * - 75-100: Stank Face (Animation 2 dominant)
 *
 * Future expansion example:
 * - 0-25: Chill
 * - 25-50: Vibing
 * - 50-75: Locked In
 * - 75-100: Stank Face
 */
export const INTENSITY_TIERS = {
  CHILL: { min: 0, max: 25 },
  GROOVE: { min: 25, max: 50 },      // Future: Animation 3
  LOCKED_IN: { min: 50, max: 75 },   // Future: Animation 4
  STANK_FACE: { min: 75, max: 100 }
};

/**
 * Map humanize dial value (0-100) to animation intensity
 * Currently linear, but can be modified for non-linear response
 * @param {number} humanizeValue - 0-100 from the humanize dial
 * @returns {number} - 0-100 intensity for Rive state machine
 */
export function getIntensityForHumanize(humanizeValue) {
  // Linear for now - can add easing or tier snapping later
  return humanizeValue;
}

/**
 * BPM-to-speed configuration
 * Base BPM is the "natural" tempo where animation plays at 1x speed
 * Hip-hop/Dilla style typically sits around 88-96 BPM
 */
export const BPM_SPEED_CONFIG = {
  BASE_BPM: 90,      // Animation plays at 1x speed at this tempo
  MIN_SPEED: 0.6,    // Minimum speed multiplier (prevents sluggish animation)
  MAX_SPEED: 1.8     // Maximum speed multiplier (prevents frantic animation)
};

/**
 * Calculate animation speed multiplier based on BPM
 * Higher BPM = faster animation, with min/max bounds
 * @param {number} bpm - Current tempo
 * @returns {number} - Speed multiplier for Rive playback
 */
export function getSpeedForBPM(bpm) {
  const { BASE_BPM, MIN_SPEED, MAX_SPEED } = BPM_SPEED_CONFIG;
  const rawSpeed = bpm / BASE_BPM;
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, rawSpeed));
}

export class RiveAvatar {
  constructor(canvasSelector) {
    this.canvas = document.querySelector(canvasSelector);
    this.riveInstance = null;
    this.intensityInput = null;
    this.currentSpeed = 1.0;
  }

  init() {
    this.riveInstance = new Rive({
      src: "./public/3dModels/head_bob.riv",
      canvas: this.canvas,
      autoplay: false,
      stateMachines: "GrooveMachine",
      layout: new Layout({
        fit: Fit.Contain,
        alignment: Alignment.Center,
      }),
      onLoad: () => {
        this.resize();
        this.getInputReference();

        // Render initial frame then pause (so canvas isn't blank)
        // Need slight delay to allow first frame to render before pausing
        this.riveInstance.play("GrooveMachine");
        setTimeout(() => {
          this.riveInstance.pause("GrooveMachine");
        }, 50);

        // Set initial intensity to 0 (matches dial default)
        this.setIntensity(0);

        // Set initial speed based on default BPM (90 = 1x speed)
        // Will be updated via bpm-update event if tempo differs
        this.setSpeed(1.0);

        window.addEventListener("dial-update", (e) => {
          this.setIntensity(e.detail.intensity);
        });

        // Listen for snare hits to punch intensity
        window.addEventListener("snare-hit", () => {
          this.punchIntensity(false);  // Main snare = full punch
        });

        // Listen for ghost snare hits for subtle punch
        window.addEventListener("ghost-snare-hit", () => {
          this.punchIntensity(true);   // Ghost snare = scaled punch
        });

        // Listen for BPM changes to adjust animation speed
        window.addEventListener("bpm-update", (e) => {
          this.setSpeed(getSpeedForBPM(e.detail.bpm));
        });
      },
    });

    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.riveInstance?.resizeDrawingSurfaceToCanvas();
  }

  getInputReference() {
    const inputs = this.riveInstance?.stateMachineInputs("GrooveMachine");
    this.intensityInput = inputs.find((input) => input.name === "Intensity");

    if (!this.intensityInput) {
      console.warn("Could not find 'Intensity' input in Rive file.");
    }
  }

  setIntensity(value) {
    if (this.intensityInput) {
      this.intensityInput.value = value;
    }
  }

  /**
   * Punch the intensity for snare hits
   * Scaled based on base intensity (from humanize dial) and whether it's a ghost note
   *
   * @param {boolean} isGhostNote - If true, use smaller punch for ghost snare
   */
  punchIntensity(isGhostNote = false) {
    if (!this.intensityInput) {
      console.warn("punchIntensity: no intensityInput");
      return;
    }

    const baseValue = this.intensityInput.value;

    // Calculate punch target based on note type and base intensity
    // Ghost notes: 40% of the punch range (subtle head bob)
    // Main snares: 100% of the punch range (full dramatic bob)
    const punchMultiplier = isGhostNote ? 0.4 : 1.0;
    const punchRange = 100 - baseValue;
    const punchTarget = Math.min(100, baseValue + (punchRange * punchMultiplier));

    // Hold duration: shorter for ghosts (snappier), longer for main hits
    const holdDuration = isGhostNote ? 200 : 500;

    console.log(`${isGhostNote ? 'Ghost' : 'Snare'} punch: ${baseValue} → ${punchTarget} (${holdDuration}ms)`);

    this.intensityInput.value = punchTarget;

    setTimeout(() => {
      this.intensityInput.value = baseValue;
    }, holdDuration);
  }

  play() {
    this.riveInstance?.play("GrooveMachine");
  }

  pause() {
    this.riveInstance?.pause("GrooveMachine");
  }

  /**
   * Set animation playback speed
   * @param {number} speed - Speed multiplier (1.0 = normal)
   */
  setSpeed(speed) {
    if (this.riveInstance) {
      this.currentSpeed = speed;
      // Rive state machine speed is controlled via the instance
      // Speed affects the state machine playback rate
      this.riveInstance.speed = speed;
    }
  }
}
