/**
 * Audio Engine
 * Handles Web Audio API operations: loading samples, scheduling notes, playback
 * Uses extracted modules for humanization and ghost note generation
 */

import { DRUM_PITCHES, PITCH_TO_TRACK } from '../constants/drums.js';
import { getHumanizedNote } from './HumanizeEngine.js';
import { extractGhostNotes } from './GhostNoteGenerator.js';

// Engine states
const STATE = {
  UNINITIALIZED: 'uninitialized',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error'
};

export class AudioEngine {
  constructor(audioCtx) {
    this.audioContext = audioCtx;
    this.samples = {};
    this.samplesLoaded = false;
    this.state = STATE.UNINITIALIZED;
    this.error = null;

    // Map MIDI pitches to sample names
    this.pitchToSample = {
      [DRUM_PITCHES.KICK]: 'kick',
      [DRUM_PITCHES.SNARE]: 'snare',
      [DRUM_PITCHES.HIHAT_CLOSED]: 'hihat-closed',
      [DRUM_PITCHES.HIHAT_OPEN]: 'hihat-open'
    };
  }

  /**
   * Check if engine is ready for playback
   * @returns {boolean}
   */
  isReady() {
    return this.state === STATE.READY;
  }

  /**
   * Get current engine state
   * @returns {string}
   */
  getState() {
    return this.state;
  }

  /**
   * Load all drum samples
   * Call this after user interaction (e.g., after clicking play)
   */
  async loadSamples() {
    if (this.samplesLoaded) return;

    this.state = STATE.LOADING;
    this.error = null;

    const sampleFiles = {
      'kick': './samples/kick.wav',
      'snare': './samples/snare.wav',
      'hihat-closed': './samples/hihat-closed.wav',
      'hihat-open': './samples/hihat-open.wav'
    };

    try {
      const loadPromises = Object.entries(sampleFiles).map(async ([name, url]) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.warn(`Sample not found: ${url} - using fallback oscillator`);
            return;
          }
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          this.samples[name] = audioBuffer;
          console.log(`Loaded sample: ${name}`);
        } catch (error) {
          console.warn(`Failed to load sample ${name}:`, error);
        }
      });

      await Promise.all(loadPromises);
      this.samplesLoaded = true;
      this.state = STATE.READY;
      console.log('All samples loaded:', Object.keys(this.samples));
    } catch (error) {
      this.state = STATE.ERROR;
      this.error = error;
      console.error('Failed to load samples:', error);
      throw error;
    }
  }

  /**
   * Schedule a note to play at a specific time
   * @param {number} time - AudioContext time to play the note
   * @param {number} pitch - MIDI pitch number
   * @param {number} velocity - MIDI velocity (0-127), defaults to 100
   * @param {number} sampleStartOffset - Offset into sample buffer in seconds (for micro-chops)
   */
  scheduleNote(time, pitch, velocity = 100, sampleStartOffset = 0) {
    const sampleName = this.pitchToSample[pitch];
    const sample = sampleName ? this.samples[sampleName] : null;

    // Convert MIDI velocity (0-127) to gain (0.0-1.0)
    const normalizedVelocity = velocity / 127;
    const gain = Math.pow(normalizedVelocity, 1.5); // Exponential curve for natural dynamics

    if (sample) {
      this.playSample(sample, time, gain, velocity, sampleStartOffset);
    } else {
      // Fallback to oscillator if sample not loaded
      this.playOscillator(time, pitch, gain);
    }
  }

  /**
   * Play an audio sample with gain and velocity-to-filter mapping
   * Low velocity = darker/muffled sound (ghost notes)
   * High velocity = bright/full sound (main hits)
   * @param {AudioBuffer} buffer - The sample to play
   * @param {number} time - AudioContext time to start
   * @param {number} gain - Gain level (0.0-1.0)
   * @param {number} velocity - MIDI velocity (1-127) for filter mapping
   * @param {number} sampleStartOffset - Offset into buffer in seconds (for micro-chops)
   */
  playSample(buffer, time, gain, velocity = 100, sampleStartOffset = 0) {
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    const filterNode = this.audioContext.createBiquadFilter();

    source.buffer = buffer;
    gainNode.gain.setValueAtTime(gain, time);

    // Velocity-to-Filter mapping (Dilla technique)
    filterNode.type = 'lowpass';
    const minCutoff = 800;
    const maxCutoff = 20000;
    const normalizedVel = velocity / 127;
    const cutoff = minCutoff + (maxCutoff - minCutoff) * Math.pow(normalizedVel, 2);

    filterNode.frequency.setValueAtTime(cutoff, time);
    filterNode.Q.setValueAtTime(0.7, time);

    // Signal chain: source → filter → gain → destination
    source.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Cleanup after playback ends
    source.onended = () => {
      source.disconnect();
      filterNode.disconnect();
      gainNode.disconnect();
    };

    // Start playback with optional offset into sample (for micro-chops)
    // Second parameter is offset into buffer in seconds
    source.start(time, sampleStartOffset);
  }

  /**
   * Fallback oscillator-based sound (used if samples aren't loaded)
   */
  playOscillator(time, pitch, gain) {
    const frequency = this.calculateFrequency(pitch);

    const oscNode = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscNode.type = 'triangle';
    oscNode.frequency.setValueAtTime(frequency, time);

    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(gain, time + 0.001);
    gainNode.gain.linearRampToValueAtTime(0, time + 0.1);

    oscNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Cleanup after oscillator stops
    oscNode.onended = () => {
      oscNode.disconnect();
      gainNode.disconnect();
    };

    oscNode.start(time);
    oscNode.stop(time + 0.1);
  }

  calculateFrequency(pitch) {
    const adjustedPitch = pitch + 24;
    return 440 * Math.pow(2, (adjustedPitch - 69) / 12);
  }

  // Re-export methods from extracted modules for backwards compatibility
  getHumanizedNote(trackIdx, stepIdx, baseTime, aiSequence, humanizeAmount, pitchMap, bpm, trackSettings = null, hihatMode = 'friction') {
    return getHumanizedNote(trackIdx, stepIdx, baseTime, aiSequence, humanizeAmount, pitchMap, bpm, trackSettings, hihatMode);
  }

  extractGhostNotes(aiSequence, originalSteps, bpm, humanizeAmount, trackSettings = null, hihatMode = 'friction') {
    return extractGhostNotes(aiSequence, originalSteps, bpm, humanizeAmount, trackSettings, hihatMode);
  }
}
