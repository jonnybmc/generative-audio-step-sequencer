import store from "../lib/state.js"; 

let initSteps = stepsObject => {
     return Object.keys(stepsObject).reduce( (accumulator, currentValue) => {   //  track-0_0, track-0_1, track-0_2
        return {
            ...accumulator,
            [currentValue] : {
                ...stepsObject[currentValue],
                active:false
            }
        }
    }, {}
    )
};

export class Store {
  constructor() {
    this.state = structuredClone(store);
    this.observers = [];
  }

  getState() {
    return this.state;
  }

  subscribe(callback) {
    this.observers.push(callback);
    return () => {
      let filteredList = this.observers.filter((cb) => cb !== callback);
      this.observers = filteredList;
    };
  }

  dispatch(action) {
    let newState = this.reducer(this.state, action);

    if (newState === this.state) return;

    this.state = newState;
    this.notify();
  }

  reducer(state, action) {
    switch (action.type) {
      case "SET_TEMPO":
        return {
          ...state,
          transport: {
            ...state.transport,
            bpm: action.payload,
          },
        };
      case "TOGGLE":
        return {
          ...state,
          steps: {
            ...state.steps,
            [action.payload]: {
              ...state.steps[action.payload],
              active: !state.steps[action.payload].active,
            },
          },
        };
      case "TOGGLE_PLAY":
        return {
          ...state,
          transport: {
            ...state.transport,
            isPlaying: !state.transport.isPlaying,
          },
        };
      case "RESET_STEPS":
        return {
          ...state,
          steps: initSteps(state.steps), //dont spread state object here as its not iteraeble
        };
      default:
        return state;
    }
  }

  notify() {
    this.observers.forEach((observer) => {
      observer(this.state);
    });
  }
}
