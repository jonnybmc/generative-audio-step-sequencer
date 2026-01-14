// 📦 Load the whole module first
import * as riveModule from "@rive-app/canvas";

// 🛠 Unpack the tools. 
// We check 'riveModule.default' (for CDNs that wrap it) OR 'riveModule' (for direct ESM)
const { Rive, Layout, Fit, Alignment } = riveModule.default || riveModule;

export class RiveAvatar {
  constructor(canvasSelector) {
    this.canvas = document.querySelector(canvasSelector);
    this.riveInstance = null;
    this.intensityInput = null;
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

        window.addEventListener("dial-update", (e) => {
          this.setIntensity(e.detail.intensity);
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

  play() {
    this.riveInstance?.play("GrooveMachine");
  }

  pause() {
    this.riveInstance?.pause("GrooveMachine");
  }
}
