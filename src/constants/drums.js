/**
 * Drum machine constants - centralized pitch and track mappings
 * Based on General MIDI drum note numbers
 */

export const DRUM_PITCHES = {
  KICK: 36,
  SNARE: 38,
  HIHAT_CLOSED: 42,
  HIHAT_OPEN: 46
};

export const TRACK_NAMES = ['KICK', 'SNARE', 'HI-HAT', 'OPEN HH'];

// Map pitch values to track indices
export const PITCH_TO_TRACK = {
  36: 0,  // Kick
  38: 1,  // Snare
  42: 2,  // Hi-hat closed
  46: 3   // Hi-hat open
};

// Map track indices to pitch values
export const TRACK_TO_PITCH = {
  0: 36,  // Kick
  1: 38,  // Snare
  2: 42,  // Hi-hat closed
  3: 46   // Hi-hat open
};

export const NUM_TRACKS = 4;
export const NUM_STEPS = 16;
