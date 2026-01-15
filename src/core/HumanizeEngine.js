/**
 * Humanize Engine
 * Timing calculations for J Dilla / MPC 3000 style swing
 * Handles tuplet offsets, push/pull dynamics, and micro-variations
 */

import { DRUM_PITCHES } from '../constants/drums.js';
import { gaussianRandom } from './MathUtils.js';

/**
 * Per-track swing multipliers - based on Dilla/MPC analysis
 * Kick swings hardest (it's the "drunk" element)
 * Hi-hats stay RIGID to create friction against lazy kick
 */
export const TRACK_SWING_MULTIPLIERS = {
  [DRUM_PITCHES.KICK]: 1.0,         // MAXIMUM swing (the drunk, dragging element)
  [DRUM_PITCHES.SNARE]: 0.2,        // Minimal swing (anchor/slingshot)
  [DRUM_PITCHES.HIHAT_CLOSED]: 0.3, // Mostly RIGID (creates friction)
  [DRUM_PITCHES.HIHAT_OPEN]: 0.4    // Slight swing
};

/**
 * Calculate tuplet offset based on humanize level
 * Uses Dilla sweet spot (57%-60%), NOT triplet (66.7%)
 * Triplet swing is too "bouncy" - Dilla's feel is more "limping"
 * @param {number} stepDuration - Duration of one 16th note in seconds
 * @param {number} humanizeAmount - 0.0 to 1.0
 * @returns {number} Offset in seconds for tuplet swing
 */
export function getTupletOffset(stepDuration, humanizeAmount) {
  // Dilla Sweet Spot: 57% (septuplet) to 60% (quintuplet)
  // NOT triplet (66.7%) - that's standard MPC swing, too bouncy
  //
  // Swing percentages:
  // - 50% = straight (1:1)
  // - 57% = septuplet (4:3) - "limping" feel
  // - 60% = quintuplet (3:2) - "loose" feel
  // - 66.7% = triplet (2:1) - standard swing (too bouncy for Dilla)

  if (humanizeAmount < 0.5) {
    // Blend straight (50%) → septuplet (57%)
    const blend = humanizeAmount / 0.5;
    const straight = stepDuration * 0.5;
    const septuplet = stepDuration * 0.57;
    return straight + (septuplet - straight) * blend;
  } else {
    // Blend septuplet (57%) → quintuplet (60%)
    const blend = (humanizeAmount - 0.5) / 0.5;
    const septuplet = stepDuration * 0.57;
    const quintuplet = stepDuration * 0.6;
    return septuplet + (quintuplet - septuplet) * blend;
  }
}

/**
 * Get micro-variation noise based on humanize level
 * Creates authentic "human" inconsistency
 * @param {number} humanizeAmount - 0.0 to 1.0
 * @returns {number} Random offset in seconds
 */
export function getMicroVariation(humanizeAmount) {
  // ±2ms at low humanize, ±8ms at high humanize
  const maxVariationMs = 2 + (humanizeAmount * 6);
  return ((Math.random() - 0.5) * 2 * maxVariationMs) / 1000;
}

/**
 * Quantize offset to MPC 3000 resolution (96 PPQN)
 * This creates the "chunky", committed feel of hardware timing
 * @param {number} offsetSeconds - The offset to quantize (in seconds)
 * @param {number} bpm - Current tempo
 * @returns {number} Quantized offset in seconds
 */
export function quantizeToMPCTicks(offsetSeconds, bpm) {
  const PPQN = 96;
  const tickDuration = (60 / bpm) / PPQN;
  const ticks = Math.round(offsetSeconds / tickDuration);
  return ticks * tickDuration;
}

/**
 * Calculate push/pull offset based on instrument type
 * Kick DRAGS (late), Snare ANCHORS (on-grid/early)
 * @param {number} pitch - MIDI pitch of the instrument
 * @param {number} humanizeAmount - Combined humanize amount (0-1)
 * @returns {number} Offset in seconds
 */
export function getPushPullOffset(pitch, humanizeAmount) {
  let offset = 0;

  if (pitch === DRUM_PITCHES.KICK) {
    // KICK: Always LATE (positive offset = drag behind the grid)
    // +15ms to +45ms late, scaled by humanize amount
    const maxDragMs = 45;
    const minDragMs = 15;
    const dragRange = maxDragMs - minDragMs;
    const baseDrag = (minDragMs + (dragRange * humanizeAmount)) / 1000;
    // Add random variation (±20%)
    offset = baseDrag * (0.8 + Math.random() * 0.4);
  } else if (pitch === DRUM_PITCHES.SNARE) {
    // SNARE: On-grid or slightly EARLY (negative offset = anchor/rush)
    const maxRushMs = 10 * humanizeAmount;
    offset = -(Math.random() * maxRushMs) / 1000;
  }
  // Hi-hats: No push/pull offset - stay rigid for FRICTION

  return offset;
}

/**
 * Get the humanized time and velocity for a note
 * @param {number} trackIdx - Track index (0-3)
 * @param {number} stepIdx - Step index (0-15)
 * @param {number} baseTime - The quantized grid time (AudioContext absolute time)
 * @param {Object} aiSequence - The AI-generated sequence with timing/velocity
 * @param {number} humanizeAmount - Blend amount (0.0 = grid, 1.0 = full AI groove)
 * @param {Object} pitchMap - Map of track index to MIDI pitch
 * @param {number} bpm - Current tempo
 * @param {Object} trackSettings - Per-track settings (swingLocked bypasses humanization)
 * @returns {Object} { time: number, velocity: number }
 */
export function getHumanizedNote(trackIdx, stepIdx, baseTime, aiSequence, humanizeAmount, pitchMap, bpm, trackSettings = null) {
  const defaultVelocity = 100;
  const targetPitch = pitchMap[trackIdx];

  // Check if track has swing locked - return grid time if so
  const isSwingLocked = trackSettings?.[trackIdx]?.swingLocked ?? false;
  if (isSwingLocked) {
    return { time: baseTime, velocity: defaultVelocity };
  }

  // Safety check - return grid time at 0% humanize
  if (humanizeAmount === 0) {
    return { time: baseTime, velocity: defaultVelocity };
  }

  const stepDuration = (60 / bpm) / 4;
  const expectedGridTime = stepIdx * stepDuration;
  const swingMultiplier = TRACK_SWING_MULTIPLIERS[targetPitch] || 0.5;

  // 1. Push/Pull: Dilla "Drunk" Formula
  const pushPullOffset = getPushPullOffset(targetPitch, humanizeAmount);

  // 2. Tuplet swing (apply only to off-beat steps)
  let tupletSwing = 0;
  if (stepIdx % 2 === 1) {
    const baseTupletOffset = getTupletOffset(stepDuration, humanizeAmount);
    const easedHumanize = 1 - Math.pow(1 - humanizeAmount, 3);
    tupletSwing = baseTupletOffset * easedHumanize * swingMultiplier * 0.15;
  }

  // 3. AI sequence offset (if available)
  let aiOffset = 0;
  if (aiSequence && aiSequence.notes) {
    const aiNote = aiSequence.notes.find(note => {
      if (note.pitch !== targetPitch) return false;
      const noteClosestStep = Math.round(note.startTime / stepDuration);
      return noteClosestStep === stepIdx;
    });

    if (aiNote) {
      aiOffset = (aiNote.startTime - expectedGridTime) * humanizeAmount * swingMultiplier;
    }
  }

  // 4. Micro-variation (human inconsistency)
  const microVariation = getMicroVariation(humanizeAmount) * swingMultiplier;

  // 5. Combine all timing offsets
  const rawOffset = pushPullOffset + aiOffset + tupletSwing + microVariation;

  // 6. Quantize to MPC 3000 resolution for authentic "chunky" feel
  const totalOffset = quantizeToMPCTicks(rawOffset, bpm);
  const humanizedTime = baseTime + totalOffset;

  // 7. Calculate velocity - Hi-hat uses AMPLITUDE MODULATION
  let finalVelocity = defaultVelocity;

  if (targetPitch === DRUM_PITCHES.HIHAT_CLOSED) {
    const isDownbeat = (stepIdx % 4 === 0);
    const isUpbeat = (stepIdx % 4 === 2);

    if (humanizeAmount === 0) {
      finalVelocity = defaultVelocity;
    } else if (isDownbeat) {
      finalVelocity = 100 + (humanizeAmount * 27);
    } else if (isUpbeat) {
      finalVelocity = 70 - (humanizeAmount * 20);
    } else {
      finalVelocity = 60 - (humanizeAmount * 20);
    }

    // Add Gaussian variation for natural feel
    finalVelocity += gaussianRandom() * 10 * humanizeAmount;
  }

  return {
    time: humanizedTime,
    velocity: Math.round(Math.max(1, Math.min(127, finalVelocity)))
  };
}
