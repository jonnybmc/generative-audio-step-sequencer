/**
 * Ghost Note Generator
 * Creates "connective tissue" ghost notes that smooth the groove
 * Based on J Dilla / MPC 3000 drumming techniques
 */

import { DRUM_PITCHES } from '../constants/drums.js';
import { gaussianProbability, gaussianVelocity } from './MathUtils.js';

/**
 * Quantize offset to MPC 3000 resolution (96 PPQN)
 * This creates the "chunky", committed feel of hardware timing
 * @param {number} offsetSeconds - The offset to quantize (in seconds)
 * @param {number} bpm - Current tempo
 * @returns {number} Quantized offset in seconds
 */
function quantizeToMPCTicks(offsetSeconds, bpm) {
  const PPQN = 96;
  const tickDuration = (60 / bpm) / PPQN;
  const ticks = Math.round(offsetSeconds / tickDuration);
  return ticks * tickDuration;
}

/**
 * Extract ghost notes - SNARE DRAGS, KICK STUMBLES, and HI-HAT TEXTURES
 * Ghost notes are "connective tissue" that smooths the groove
 * @param {Object} aiSequence - The AI-generated sequence (unused, kept for API compat)
 * @param {Object} originalSteps - The original step pattern from the store
 * @param {number} bpm - Current tempo
 * @param {number} humanizeAmount - Controls ghost note density (0-1)
 * @param {Object} trackSettings - Per-track humanize settings (optional)
 * @returns {Array} Array of ghost notes to play
 */
export function extractGhostNotes(aiSequence, originalSteps, bpm, humanizeAmount, trackSettings = null) {
  // No ghost notes below 30% humanization
  if (humanizeAmount < 0.3) {
    return [];
  }

  const stepDuration = (60 / bpm) / 4; // 16th note duration
  const ghostNotes = [];

  // 1. SNARE GHOSTS (30%+ humanize) - Drags and ruffs
  const snareGhostsEnabled = trackSettings?.[1]?.ghostsEnabled ?? true;
  if (snareGhostsEnabled) {
    const snareHumanizeMult = trackSettings?.[1]?.humanize ?? 100;
    const snareEffectiveHumanize = humanizeAmount * (snareHumanizeMult / 100);
    if (snareEffectiveHumanize >= 0.3) {
      ghostNotes.push(...generateSnareGhosts(originalSteps, stepDuration, snareEffectiveHumanize, bpm));
    }
  }

  // 2. KICK GHOSTS (50%+ humanize) - Stumbles
  const kickGhostsEnabled = trackSettings?.[0]?.ghostsEnabled ?? true;
  if (kickGhostsEnabled && humanizeAmount >= 0.5) {
    const kickHumanizeMult = trackSettings?.[0]?.humanize ?? 100;
    const kickEffectiveHumanize = humanizeAmount * (kickHumanizeMult / 100);
    if (kickEffectiveHumanize >= 0.5) {
      ghostNotes.push(...generateKickGhosts(originalSteps, stepDuration, kickEffectiveHumanize, bpm));
    }
  }

  // 3. CLOSED HI-HAT GHOSTS (track 2) - Skip ghosts only
  const closedHihatGhostsEnabled = trackSettings?.[2]?.ghostsEnabled ?? false;
  if (closedHihatGhostsEnabled && humanizeAmount >= 0.4) {
    const closedHihatMult = trackSettings?.[2]?.humanize ?? 100;
    const closedHihatEffective = humanizeAmount * (closedHihatMult / 100);
    if (closedHihatEffective >= 0.4) {
      ghostNotes.push(...generateClosedHiHatGhosts(originalSteps, stepDuration, closedHihatEffective, bpm));
    }
  }

  // 4. OPEN HI-HAT GHOSTS (track 3) - Slurp ghosts only
  const openHihatGhostsEnabled = trackSettings?.[3]?.ghostsEnabled ?? false;
  if (openHihatGhostsEnabled && humanizeAmount >= 0.6) {
    const openHihatMult = trackSettings?.[3]?.humanize ?? 100;
    const openHihatEffective = humanizeAmount * (openHihatMult / 100);
    if (openHihatEffective >= 0.6) {
      ghostNotes.push(...generateOpenHiHatGhosts(originalSteps, stepDuration, openHihatEffective, bpm));
    }
  }

  return ghostNotes;
}

/**
 * Generate SNARE ghost notes - the "drag" and "ruff"
 * Simulates drummer's left hand performing rudiments before/after backbeat
 * @returns {Array} Snare ghost notes
 */
export function generateSnareGhosts(originalSteps, stepDuration, humanizeAmount, bpm) {
  const ghosts = [];

  // Main snare positions (backbeats: beats 2 and 4)
  const mainSnareSteps = [4, 12];

  mainSnareSteps.forEach(mainStep => {
    // === PRE-BEAT DRAG (step before main snare) ===
    const preDragStep = mainStep - 1; // Steps 3 and 11

    if (!originalSteps[`track-1_${preDragStep}`]?.active) {
      if (gaussianProbability(0.4 * humanizeAmount)) {
        const lateOffset = stepDuration * 0.3 * humanizeAmount;
        const baseTime = preDragStep * stepDuration + lateOffset;
        const quantizedTime = quantizeToMPCTicks(baseTime, bpm);

        ghosts.push({
          pitch: DRUM_PITCHES.SNARE,
          step: preDragStep,
          startTime: quantizedTime,
          velocity: gaussianVelocity(30, 5)
        });
      }
    }

    // === POST-BEAT CHATTER (step after main snare) ===
    const postChatterStep = mainStep + 1; // Steps 5 and 13

    if (!originalSteps[`track-1_${postChatterStep}`]?.active) {
      if (gaussianProbability(0.3 * humanizeAmount)) {
        const lateOffset = stepDuration * 0.2 * humanizeAmount;
        const baseTime = postChatterStep * stepDuration + lateOffset;
        const quantizedTime = quantizeToMPCTicks(baseTime, bpm);

        ghosts.push({
          pitch: DRUM_PITCHES.SNARE,
          step: postChatterStep,
          startTime: quantizedTime,
          velocity: gaussianVelocity(28, 4)
        });
      }
    }
  });

  return ghosts;
}

/**
 * Generate KICK ghost notes - the "stumble"
 * Creates "falling down stairs" sensation, destabilizes groove just enough
 * @returns {Array} Kick ghost notes
 */
export function generateKickGhosts(originalSteps, stepDuration, humanizeAmount, bpm) {
  const ghosts = [];

  // Ghost kick candidates - weak 16ths ("e" and "a" subdivisions)
  const ghostKickCandidates = [
    { step: 15, weight: 0.7 }, // "a" of beat 4 - MOST COMMON
    { step: 7, weight: 0.4 },  // "a" of beat 2
    { step: 3, weight: 0.3 },  // "a" of beat 1
    { step: 11, weight: 0.35 }, // "a" of beat 3
  ];

  ghostKickCandidates.forEach(candidate => {
    if (originalSteps[`track-0_${candidate.step}`]?.active) return;

    const effectiveHumanize = (humanizeAmount - 0.5) * 2;
    const probability = candidate.weight * effectiveHumanize;

    if (gaussianProbability(probability)) {
      const lateOffset = stepDuration * 0.25 * humanizeAmount;
      const baseTime = candidate.step * stepDuration + lateOffset;
      const quantizedTime = quantizeToMPCTicks(baseTime, bpm);

      ghosts.push({
        pitch: DRUM_PITCHES.KICK,
        step: candidate.step,
        startTime: quantizedTime,
        velocity: gaussianVelocity(70, 10)
      });
    }
  });

  return ghosts;
}

/**
 * Generate CLOSED HI-HAT ghost notes - the "skip"
 * Creates shuffle/friction texture that contrasts with straight main hats
 * @returns {Array} Closed hi-hat ghost notes (pitch 42 only)
 */
export function generateClosedHiHatGhosts(originalSteps, stepDuration, humanizeAmount, bpm) {
  const ghosts = [];

  // SKIPPING GHOSTS - "e" and "a" 16th notes (odd steps)
  const skipCandidates = [1, 3, 5, 7, 9, 11, 13, 15];
  skipCandidates.forEach(step => {
    if (originalSteps[`track-2_${step}`]?.active) return;

    if (gaussianProbability(0.3 * humanizeAmount)) {
      const lateOffset = (20 + Math.random() * 15) / 1000;
      const baseTime = step * stepDuration + lateOffset;

      ghosts.push({
        pitch: DRUM_PITCHES.HIHAT_CLOSED,
        step: step,
        startTime: quantizeToMPCTicks(baseTime, bpm),
        velocity: gaussianVelocity(30, 8)
      });
    }
  });

  return ghosts;
}

/**
 * Generate OPEN HI-HAT ghost notes - the "slurp"
 * Creates "breathing" texture - short open hat choked by following kick
 * @returns {Array} Open hi-hat ghost notes (pitch 46 only)
 */
export function generateOpenHiHatGhosts(originalSteps, stepDuration, humanizeAmount, bpm) {
  const ghosts = [];

  // SLURP GHOSTS - Open hat on "a" before downbeats
  const slurpCandidates = [3, 7, 11, 15];
  slurpCandidates.forEach(step => {
    if (originalSteps[`track-3_${step}`]?.active) return;
    if (originalSteps[`track-2_${step}`]?.active) return;

    if (gaussianProbability(0.25 * humanizeAmount)) {
      const lateOffset = stepDuration * 0.15;
      const baseTime = step * stepDuration + lateOffset;

      ghosts.push({
        pitch: DRUM_PITCHES.HIHAT_OPEN,
        step: step,
        startTime: quantizeToMPCTicks(baseTime, bpm),
        velocity: gaussianVelocity(70, 10)
      });
    }
  });

  return ghosts;
}
