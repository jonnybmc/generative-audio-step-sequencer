/**
 * Ghost Note Generator
 * Creates "connective tissue" ghost notes that smooth the groove
 * Based on J Dilla / MPC 3000 drumming techniques
 *
 * Ghost quantity (0-100%) controls HOW MANY ghosts appear
 * Humanize dial controls WHERE they land (timing) and HOW LOUD (velocity)
 * Ghost notes always have minimum 30% timing offset to preserve syncopation character
 */

import { DRUM_PITCHES } from '../constants/drums.js';
import { gaussianProbability, gaussianVelocity } from './MathUtils.js';
import { AI_BLEND_CONFIG } from './HumanizeEngine.js';

// Minimum timing offset ratio - ghosts are always slightly off-grid
const MIN_OFFSET_RATIO = 0.3;

/**
 * Find nearest AI note velocity for a given pitch and step
 * Used to inherit AI accent patterns for ghost notes
 * @param {Object} aiSequence - The AI-generated sequence
 * @param {number} pitch - MIDI pitch to match
 * @param {number} step - Current step index
 * @param {number} stepDuration - Duration of one step in seconds
 * @param {number} defaultVelocity - Fallback velocity if no AI note found
 * @returns {number} AI velocity or default
 */
function findNearestAIVelocity(aiSequence, pitch, step, stepDuration, defaultVelocity = 50) {
  if (!aiSequence || !aiSequence.notes) return defaultVelocity;

  const aiNote = aiSequence.notes.find(note => {
    if (note.pitch !== pitch) return false;
    const noteStep = Math.round(note.startTime / stepDuration);
    // Look for AI notes within 1 step of the ghost position
    return Math.abs(noteStep - step) <= 1;
  });

  return aiNote?.velocity ?? defaultVelocity;
}

/**
 * Blend formula velocity with AI velocity
 * @param {number} formulaVelocity - Base velocity from formula
 * @param {number} aiVelocity - Velocity from AI sequence
 * @returns {number} Blended velocity
 */
function blendGhostVelocity(formulaVelocity, aiVelocity) {
  const weight = AI_BLEND_CONFIG.ghostVelocityWeight;
  return (formulaVelocity * (1 - weight)) + (aiVelocity * weight);
}

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
 * Get effective offset ratio - ensures ghosts are always off-grid
 * @param {number} humanizeAmount - Global humanize dial value (0-1)
 * @returns {number} Effective offset ratio (minimum 0.3)
 */
function getEffectiveOffsetRatio(humanizeAmount) {
  return Math.max(MIN_OFFSET_RATIO, humanizeAmount);
}

/**
 * Extract ghost notes based on per-track ghostQuantity settings
 * @param {Object} aiSequence - The AI-generated sequence (unused, kept for API compat)
 * @param {Object} originalSteps - The original step pattern from the store
 * @param {number} bpm - Current tempo
 * @param {number} humanizeAmount - Controls ghost timing offsets and velocity (0-1)
 * @param {Object} trackSettings - Per-track ghost quantity settings
 * @param {string} hihatMode - 'friction' (default) or 'limp' (closed HH ghosts drag late)
 * @returns {Array} Array of ghost notes to play
 */
export function extractGhostNotes(aiSequence, originalSteps, bpm, humanizeAmount, trackSettings = null, hihatMode = 'friction') {
  const stepDuration = (60 / bpm) / 4; // 16th note duration
  const ghostNotes = [];
  const offsetRatio = getEffectiveOffsetRatio(humanizeAmount);

  // 1. SNARE GHOSTS (track 1)
  const snareQuantity = (trackSettings?.[1]?.ghostQuantity ?? 0) / 100;
  if (snareQuantity > 0) {
    ghostNotes.push(...generateSnareGhosts(originalSteps, stepDuration, offsetRatio, snareQuantity, bpm, aiSequence));
  }

  // 2. KICK GHOSTS (track 0)
  const kickQuantity = (trackSettings?.[0]?.ghostQuantity ?? 0) / 100;
  if (kickQuantity > 0) {
    ghostNotes.push(...generateKickGhosts(originalSteps, stepDuration, offsetRatio, kickQuantity, bpm, aiSequence));
  }

  // 3. CLOSED HI-HAT GHOSTS (track 2) - respects hihatMode
  const closedHihatQuantity = (trackSettings?.[2]?.ghostQuantity ?? 0) / 100;
  if (closedHihatQuantity > 0) {
    ghostNotes.push(...generateClosedHiHatGhosts(originalSteps, stepDuration, offsetRatio, closedHihatQuantity, bpm, hihatMode, aiSequence));
  }

  // 4. OPEN HI-HAT GHOSTS (track 3) - respects hihatMode for live mode rush
  const openHihatQuantity = (trackSettings?.[3]?.ghostQuantity ?? 0) / 100;
  if (openHihatQuantity > 0) {
    ghostNotes.push(...generateOpenHiHatGhosts(originalSteps, stepDuration, offsetRatio, openHihatQuantity, bpm, hihatMode, aiSequence));
  }

  return ghostNotes;
}

/**
 * Generate SNARE ghost notes - the "drag" and "ruff"
 * Simulates drummer's left hand performing rudiments before/after backbeat
 * @param {Object} originalSteps - Step pattern
 * @param {number} stepDuration - Duration of one 16th note
 * @param {number} offsetRatio - Timing offset multiplier (0.3-1.0)
 * @param {number} quantity - Ghost quantity (0-1)
 * @param {number} bpm - Current tempo
 * @param {Object} aiSequence - AI sequence for velocity blending
 * @returns {Array} Snare ghost notes
 */
export function generateSnareGhosts(originalSteps, stepDuration, offsetRatio, quantity, bpm, aiSequence = null) {
  const ghosts = [];
  const baseProbability = 0.6; // Max probability at 100% quantity

  // Main snare positions (backbeats: beats 2 and 4)
  const mainSnareSteps = [4, 12];

  mainSnareSteps.forEach(mainStep => {
    // === PRE-BEAT DRAG (step before main snare) ===
    const preDragStep = mainStep - 1; // Steps 3 and 11

    if (!originalSteps[`track-1_${preDragStep}`]?.active) {
      if (gaussianProbability(baseProbability * quantity)) {
        const lateOffset = stepDuration * 0.3 * offsetRatio;
        const baseTime = preDragStep * stepDuration + lateOffset;
        const quantizedTime = quantizeToMPCTicks(baseTime, bpm);

        // Velocity: blend formula with AI for organic accent patterns
        // σ=22 for aggressive ghost dynamics (producer feedback: 00:08:41)
        const formulaVelocity = 25 + (offsetRatio * 10);
        const aiVelocity = findNearestAIVelocity(aiSequence, DRUM_PITCHES.SNARE, preDragStep, stepDuration, formulaVelocity);
        const blendedVelocity = blendGhostVelocity(formulaVelocity, aiVelocity);

        ghosts.push({
          pitch: DRUM_PITCHES.SNARE,
          step: preDragStep,
          startTime: quantizedTime,
          velocity: gaussianVelocity(blendedVelocity, 22)
        });
      }
    }

    // === POST-BEAT CHATTER (step after main snare) ===
    const postChatterStep = mainStep + 1; // Steps 5 and 13

    if (!originalSteps[`track-1_${postChatterStep}`]?.active) {
      if (gaussianProbability(baseProbability * quantity * 0.7)) {
        const lateOffset = stepDuration * 0.2 * offsetRatio;
        const baseTime = postChatterStep * stepDuration + lateOffset;
        const quantizedTime = quantizeToMPCTicks(baseTime, bpm);

        const formulaVelocity = 22 + (offsetRatio * 8);
        const aiVelocity = findNearestAIVelocity(aiSequence, DRUM_PITCHES.SNARE, postChatterStep, stepDuration, formulaVelocity);
        const blendedVelocity = blendGhostVelocity(formulaVelocity, aiVelocity);

        ghosts.push({
          pitch: DRUM_PITCHES.SNARE,
          step: postChatterStep,
          startTime: quantizedTime,
          velocity: gaussianVelocity(blendedVelocity, 20)
        });
      }
    }
  });

  return ghosts;
}

/**
 * Generate KICK ghost notes - the "stumble"
 * Creates "falling down stairs" sensation, destabilizes groove just enough
 * @param {Object} originalSteps - Step pattern
 * @param {number} stepDuration - Duration of one 16th note
 * @param {number} offsetRatio - Timing offset multiplier (0.3-1.0)
 * @param {number} quantity - Ghost quantity (0-1)
 * @param {number} bpm - Current tempo
 * @param {Object} aiSequence - AI sequence for velocity blending
 * @returns {Array} Kick ghost notes
 */
export function generateKickGhosts(originalSteps, stepDuration, offsetRatio, quantity, bpm, aiSequence = null) {
  const ghosts = [];
  const baseProbability = 0.5; // Max probability at 100% quantity

  // Ghost kick candidates - weak 16ths ("e" and "a" subdivisions)
  const ghostKickCandidates = [
    { step: 15, weight: 0.8 }, // "a" of beat 4 - MOST COMMON
    { step: 7, weight: 0.5 },  // "a" of beat 2
    { step: 3, weight: 0.4 },  // "a" of beat 1
    { step: 11, weight: 0.45 }, // "a" of beat 3
  ];

  ghostKickCandidates.forEach(candidate => {
    if (originalSteps[`track-0_${candidate.step}`]?.active) return;

    const probability = baseProbability * quantity * candidate.weight;

    if (gaussianProbability(probability)) {
      const lateOffset = stepDuration * 0.25 * offsetRatio;
      const baseTime = candidate.step * stepDuration + lateOffset;
      const quantizedTime = quantizeToMPCTicks(baseTime, bpm);

      // Kick ghosts are louder than snare ghosts
      // σ=25 for maximum "stumble" dynamics
      const formulaVelocity = 60 + (offsetRatio * 15);
      const aiVelocity = findNearestAIVelocity(aiSequence, DRUM_PITCHES.KICK, candidate.step, stepDuration, formulaVelocity);
      const blendedVelocity = blendGhostVelocity(formulaVelocity, aiVelocity);

      ghosts.push({
        pitch: DRUM_PITCHES.KICK,
        step: candidate.step,
        startTime: quantizedTime,
        velocity: gaussianVelocity(blendedVelocity, 25)
      });
    }
  });

  return ghosts;
}

/**
 * Generate CLOSED HI-HAT ghost notes - the "skip"
 * Creates shuffle/friction texture that contrasts with straight main hats
 * In limp mode, adds extra late offset to match main note drag
 * @param {Object} originalSteps - Step pattern
 * @param {number} stepDuration - Duration of one 16th note
 * @param {number} offsetRatio - Timing offset multiplier (0.3-1.0)
 * @param {number} quantity - Ghost quantity (0-1)
 * @param {number} bpm - Current tempo
 * @param {string} hihatMode - 'friction' (default) or 'limp' (adds late drag)
 * @param {Object} aiSequence - AI sequence for velocity blending
 * @returns {Array} Closed hi-hat ghost notes
 */
export function generateClosedHiHatGhosts(originalSteps, stepDuration, offsetRatio, quantity, bpm, hihatMode = 'friction', aiSequence = null) {
  const ghosts = [];
  const baseProbability = 0.45;

  // SKIPPING GHOSTS - "e" and "a" 16th notes (odd steps)
  const skipCandidates = [1, 3, 5, 7, 9, 11, 13, 15];
  skipCandidates.forEach(step => {
    if (originalSteps[`track-2_${step}`]?.active) return;

    if (gaussianProbability(baseProbability * quantity)) {
      const lateOffset = (15 + Math.random() * 20) / 1000 * offsetRatio;

      // Mode-specific offset for closed hi-hat ghosts
      let modeOffset = 0;
      if (hihatMode === 'limp') {
        // Limp mode: add extra late offset (+8-12ms) to match main closed HH drag
        modeOffset = (8 + Math.random() * 4) / 1000;
      } else if (hihatMode === 'live') {
        // Live mode: ghosts rush early (-5 to -10ms) like a live drummer
        modeOffset = -(5 + Math.random() * 5) / 1000;
      }
      const baseTime = step * stepDuration + lateOffset + modeOffset;

      const formulaVelocity = 25 + (offsetRatio * 10);
      const aiVelocity = findNearestAIVelocity(aiSequence, DRUM_PITCHES.HIHAT_CLOSED, step, stepDuration, formulaVelocity);
      const blendedVelocity = blendGhostVelocity(formulaVelocity, aiVelocity);

      ghosts.push({
        pitch: DRUM_PITCHES.HIHAT_CLOSED,
        step: step,
        startTime: quantizeToMPCTicks(baseTime, bpm),
        velocity: gaussianVelocity(blendedVelocity, 22)
      });
    }
  });

  return ghosts;
}

/**
 * Generate OPEN HI-HAT ghost notes - the "slurp"
 * Creates "breathing" texture - short open hat choked by following kick
 * In live mode, ghosts rush early like a live drummer
 * @param {Object} originalSteps - Step pattern
 * @param {number} stepDuration - Duration of one 16th note
 * @param {number} offsetRatio - Timing offset multiplier (0.3-1.0)
 * @param {number} quantity - Ghost quantity (0-1)
 * @param {number} bpm - Current tempo
 * @param {string} hihatMode - 'friction' (default), 'limp', or 'live' (adds early rush)
 * @param {Object} aiSequence - AI sequence for velocity blending
 * @returns {Array} Open hi-hat ghost notes
 */
export function generateOpenHiHatGhosts(originalSteps, stepDuration, offsetRatio, quantity, bpm, hihatMode = 'friction', aiSequence = null) {
  const ghosts = [];
  const baseProbability = 0.4;

  // SLURP GHOSTS - Open hat on "a" before downbeats
  const slurpCandidates = [3, 7, 11, 15];
  slurpCandidates.forEach(step => {
    if (originalSteps[`track-3_${step}`]?.active) return;
    if (originalSteps[`track-2_${step}`]?.active) return;

    if (gaussianProbability(baseProbability * quantity)) {
      const lateOffset = stepDuration * 0.15 * offsetRatio;

      // Mode-specific offset for open hi-hat ghosts
      let modeOffset = 0;
      if (hihatMode === 'live') {
        // Live mode: ghosts rush early (-3 to -8ms) like a live drummer
        modeOffset = -(3 + Math.random() * 5) / 1000;
      }
      // In friction and limp modes, open hi-hat ghosts stay on their default timing
      // (open hi-hat serves accent/anticipation role, doesn't drag in limp mode)

      const baseTime = step * stepDuration + lateOffset + modeOffset;

      const formulaVelocity = 55 + (offsetRatio * 20);
      const aiVelocity = findNearestAIVelocity(aiSequence, DRUM_PITCHES.HIHAT_OPEN, step, stepDuration, formulaVelocity);
      const blendedVelocity = blendGhostVelocity(formulaVelocity, aiVelocity);

      ghosts.push({
        pitch: DRUM_PITCHES.HIHAT_OPEN,
        step: step,
        startTime: quantizeToMPCTicks(baseTime, bpm),
        velocity: gaussianVelocity(blendedVelocity, 25)
      });
    }
  });

  return ghosts;
}
