function generateSteps(numTracks, numSteps) {
  let obj = {};
  for (let i = 0; i < numTracks; i++) {
    for (let j = 0; j < numSteps; j++) {
      let uuid = `track-${i}_${j}`;
      let newObj = {
        id: uuid,
        active: false,
      };
      obj[uuid] = newObj;
    }
  }
  console.log('this is the steps object', obj);
  return obj;
}

const initialState = {
    transport: {
        bpm: 120,
        isPlaying: false
    },
    steps: generateSteps(4, 16),
};

export default initialState;
