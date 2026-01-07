// Default Dilla pattern - rigid at 0% humanize, drunk swing emerges as dial increases
// Track mapping: 0=Kick, 1=Snare, 2=Hi-hat closed, 3=Hi-hat open
const DEFAULT_ACTIVE_STEPS = {
  // Kick: four-on-floor anchor (stays locked even at high humanize)
  'track-0_0': true,
  'track-0_4': true,
  'track-0_8': true,
  'track-0_12': true,

  // Snare: backbeat (drags slightly behind at high humanize)
  'track-1_4': true,
  'track-1_12': true,

  // Hi-hat closed: 8th notes (swings hardest, ghost notes fill gaps)
  'track-2_0': true,
  'track-2_2': true,
  'track-2_4': true,
  'track-2_6': true,
  'track-2_8': true,
  'track-2_10': true,
  'track-2_12': true,
  'track-2_14': true,

  // Hi-hat open: anticipates the one (creates tension before downbeat)
  'track-3_14': true,
};

function generateSteps(numTracks, numSteps) {
  let obj = {};
  for (let i = 0; i < numTracks; i++) {
    for (let j = 0; j < numSteps; j++) {
      let uuid = `track-${i}_${j}`;
      let newObj = {
        id: uuid,
        active: DEFAULT_ACTIVE_STEPS[uuid] || false,
      };
      obj[uuid] = newObj;
    }
  }
  return obj;
}

const initialState = {
    transport: {
        bpm: 88,  // Dilla sweet spot: 86-94 BPM
        isPlaying: false
    },
    steps: generateSteps(4, 16),
    humanizeValue: 0,
    // Per-track humanize settings
    // humanize: 0-100 (multiplier against main dial)
    // swingEnabled: if false, track stays on-grid regardless of main dial
    // ghostsEnabled: if false, no ghost notes for this track
    trackSettings: {
        0: { humanize: 100, swingEnabled: true, ghostsEnabled: true },  // Kick
        1: { humanize: 100, swingEnabled: true, ghostsEnabled: true },  // Snare
        2: { humanize: 100, swingEnabled: true, ghostsEnabled: false }, // Hi-hat closed (uses AM instead)
        3: { humanize: 100, swingEnabled: true, ghostsEnabled: false }  // Hi-hat open
    }
};

export default initialState;
