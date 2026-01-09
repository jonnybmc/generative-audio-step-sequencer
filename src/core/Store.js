import store from "../lib/state.js";

let initSteps = (stepsObject) => {
  return Object.keys(stepsObject).reduce((accumulator, currentValue) => {
    //  track-0_0, track-0_1, track-0_2
    return {
      ...accumulator,
      [currentValue]: {
        ...stepsObject[currentValue],
        active: false,
      },
    };
  }, {});
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

  /**
   * Subscribe to changes in a specific slice of state
   * Only fires callback when the selected value changes
   * @param {Function} selector - Function that extracts the value to watch (e.g., state => state.transport.bpm)
   * @param {Function} callback - Called with (newValue, oldValue) when selected value changes
   * @returns {Function} Unsubscribe function
   */
  subscribeToSelector(selector, callback) {
    let lastValue = selector(this.state);
    return this.subscribe((newState) => {
      const newValue = selector(newState);
      if (newValue !== lastValue) {
        const oldValue = lastValue;
        lastValue = newValue;
        callback(newValue, oldValue);
      }
    });
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
      case "SET_HUMANIZE":
        return { ...state, humanizeValue: action.payload };
      case "SET_TRACK_HUMANIZE":
        return {
          ...state,
          trackSettings: {
            ...state.trackSettings,
            [action.payload.track]: {
              ...state.trackSettings[action.payload.track],
              humanize: action.payload.value
            }
          }
        };
      case "TOGGLE_TRACK_SWING":
        return {
          ...state,
          trackSettings: {
            ...state.trackSettings,
            [action.payload]: {
              ...state.trackSettings[action.payload],
              swingEnabled: !state.trackSettings[action.payload].swingEnabled
            }
          }
        };
      case "TOGGLE_TRACK_GHOSTS":
        return {
          ...state,
          trackSettings: {
            ...state.trackSettings,
            [action.payload]: {
              ...state.trackSettings[action.payload],
              ghostsEnabled: !state.trackSettings[action.payload].ghostsEnabled
            }
          }
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
