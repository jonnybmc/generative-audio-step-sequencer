export class Grid {
  constructor(store, targetDOMElem) {
    this.store = store;
    this.state = store.getState();
    this.rootElem = targetDOMElem;
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
    this.render(this.state);
    this.subscribe();
  }

  subscribe() {
    this.store.subscribe(this.render.bind(this));
  }

  updatePlayhead(currentStepIndex) {
    //first remove all the current playuing calsses i.e. re-init
    const currentlyPlayingSteps = this.rootElem.querySelectorAll(".playing");
    currentlyPlayingSteps.forEach((step) => {
      step.classList.remove("playing");
    });

    // loop the 4 tracks and then light up each column at the given currentStepIndex
    for (let i = 0; i < 4; i++) {
      let stepId = `track-${i}_${currentStepIndex}`;
      let elem = document.getElementById(stepId);
      if (elem) {
        elem.classList.add("playing");
      }
    }
  }

  render(state) {
    let steps = Object.values(state.steps);
    let HTMLNodes = steps.map((step) => {
      return `<div class="step ${step.active ? "active" : ""}" id="${
        step.id
      }"></div>`;
    });
    this.rootElem.innerHTML = HTMLNodes.join(" ");
  }
}
