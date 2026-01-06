import { Clock } from "../core/Clock";
import { Store } from "../core/Store";

let myStore = new Store();

let clockConfig = {
  audioContext: new window.AudioContext(),
  getTempo: () => {
    return myStore.getState().transport.bpm;
  },
  onTick: (step, time) => {
    console.log(step, time);
  },
};

let myClock = new Clock(clockConfig);

myClock.start();

setTimeout(() => {
  myStore.dispatch({
    type: "SET_TEMPO",
    payload: 80,
  });
}, 2000);
