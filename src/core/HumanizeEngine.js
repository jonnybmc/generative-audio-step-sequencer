/**
 * Humanize Engine
 * Timing calculations for J Dilla / MPC 3000 style swing
 * Handles tuplet offsets, push/pull dynamics, and micro-variations
 */

import { DRUM_PITCHES } from '../constants/drums.js';
import { gaussianRandom } from './MathUtils.js';

/**
 * MAX_BPM Ceiling for timing calculations
 * At higher tempos, timing offsets (+15-45ms) become a smaller percentage of beat duration,
 * reducing the psychoacoustic "rub" effect. Cap at 96 BPM for consistent groove character.
 * The sequencer still plays at user's tempo, but timing math uses effective BPM.
 * (Producer feedback: 00:13:23)
 */
export const DILLA_MAX_BPM = 96;

/**
 * AI blend configuration
 * Controls how much AI variation is mixed with formula-driven timing/velocity
 * Formula defines the Dilla signature; AI provides organic variation on top.
 *
 * 0.0 = pure formula (current Dilla signature)
 * 1.0 = maximum AI influence (still formula base, AI variation layered)
 */
export const AI_BLEND_CONFIG = {
  velocityWeight: 0.3,      // 30% AI velocity contribution for main hits
  microTimingWeight: 0.5,   // 50% AI micro-timing (replaces random noise)
  ghostVelocityWeight: 0.5  // 50% AI velocity for ghost notes (used in GhostNoteGenerator)
};

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
 * Swing multipliers for "limp" mode - closed hi-hat gets enhanced swing
 * Open hi-hat retains original value (serves accent/anticipation role)
 * Based on producer feedback: 00:03:51 "Move the hats later... walking with a limp"
 */
export const TRACK_SWING_MULTIPLIERS_LIMP = {
  [DRUM_PITCHES.KICK]: 1.0,
  [DRUM_PITCHES.SNARE]: 0.2,
  [DRUM_PITCHES.HIHAT_CLOSED]: 0.62,  // Producer's 62% swing (limp mode)
  [DRUM_PITCHES.HIHAT_OPEN]: 0.4      // Keep original (accent/anticipation role)
};

/**
 * Swing multipliers for "live" mode - both hi-hats get moderate swing
 * Simulates live drummer feel where hi-hat hand rushes ahead
 * Based on producer feedback: 00:02:12 BioBias tensor (hats rush)
 */
export const TRACK_SWING_MULTIPLIERS_LIVE = {
  [DRUM_PITCHES.KICK]: 1.0,
  [DRUM_PITCHES.SNARE]: 0.2,
  [DRUM_PITCHES.HIHAT_CLOSED]: 0.5,   // Moderate swing (live drummer feel)
  [DRUM_PITCHES.HIHAT_OPEN]: 0.45     // Slightly less than closed (accent role)
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
 * Calculate push/pull offset based on instrument type and hi-hat mode
 * Kick DRAGS (late), Snare ANCHORS (on-grid/early)
 * In 'limp' mode, closed hi-hat also drags late
 * @param {number} pitch - MIDI pitch of the instrument
 * @param {number} humanizeAmount - Combined humanize amount (0-1)
 * @param {string} hihatMode - 'friction' (default, rigid) or 'limp' (closed HH drags)
 * @returns {number} Offset in seconds
 */
export function getPushPullOffset(pitch, humanizeAmount, hihatMode = 'friction') {
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
    // SNARE: Aggressive anchor/slingshot - always EARLY (negative offset)
    // Range: -10ms to -25ms based on humanize amount (producer feedback: 00:03:07)
    const minRushMs = 10;
    const maxRushMs = 25;
    const rushRange = maxRushMs - minRushMs;
    const rush = minRushMs + (rushRange * humanizeAmount);
    offset = -(Math.random() * rush) / 1000;
  } else if (hihatMode === 'limp' && pitch === DRUM_PITCHES.HIHAT_CLOSED) {
    // CLOSED HI-HAT in LIMP mode: Drags late like the kick (walking with a limp)
    // +8ms to +20ms late based on humanize amount (producer feedback: 00:03:51)
    // Open hi-hat stays rigid (accent/anticipation function)
    const maxDragMs = 20;
    const minDragMs = 8;
    const dragRange = maxDragMs - minDragMs;
    const baseDrag = (minDragMs + (dragRange * humanizeAmount)) / 1000;
    offset = baseDrag * (0.8 + Math.random() * 0.4);
  } else if (hihatMode === 'live') {
    // LIVE mode: Both hi-hats RUSH (negative offset = ahead of grid)
    // Simulates live drummer BioBias where hi-hat hand anticipates the beat
    // (producer feedback: 00:02:12)
    if (pitch === DRUM_PITCHES.HIHAT_CLOSED) {
      // Closed hi-hat rushes more aggressively: -5ms to -15ms
      const maxRushMs = 15;
      const minRushMs = 5;
      const rushRange = maxRushMs - minRushMs;
      const baseRush = (minRushMs + (rushRange * humanizeAmount)) / 1000;
      offset = -baseRush * (0.8 + Math.random() * 0.4);  // Negative = early
    } else if (pitch === DRUM_PITCHES.HIHAT_OPEN) {
      // Open hi-hat rushes slightly less: -3ms to -8ms (still serves accent role)
      const maxRushMs = 8;
      const minRushMs = 3;
      const rushRange = maxRushMs - minRushMs;
      const baseRush = (minRushMs + (rushRange * humanizeAmount)) / 1000;
      offset = -baseRush * (0.8 + Math.random() * 0.4);  // Negative = early
    }
  }
  // In friction mode: Hi-hats have no push/pull offset - stay rigid for FRICTION

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
 * @param {string} hihatMode - 'friction' (default) or 'limp' (closed HH drags late)
 * @returns {Object} { time: number, velocity: number }
 */
export function getHumanizedNote(trackIdx, stepIdx, baseTime, aiSequence, humanizeAmount, pitchMap, bpm, trackSettings = null, hihatMode = 'friction') {
  const defaultVelocity = 100;
  const targetPitch = pitchMap[trackIdx];

  // Check if track has swing locked - return grid time if so
  const isSwingLocked = trackSettings?.[trackIdx]?.swingLocked ?? false;

  // Live mode auto-locks kick for cohesive groove (rushing hats + steady kick)
  const isLiveModeKickLock = hihatMode === 'live' && targetPitch === DRUM_PITCHES.KICK;

  // Either manually locked OR auto-locked by Live mode
  if (isSwingLocked || isLiveModeKickLock) {
    return { time: baseTime, velocity: defaultVelocity };
  }

  // Safety check - return grid time at 0% humanize
  if (humanizeAmount === 0) {
    return { time: baseTime, velocity: defaultVelocity };
  }

  // Use effective BPM capped at 96 for timing calculations
  // At higher tempos, this preserves the groove feel by making offsets
  // represent the same proportion of the beat as at 96 BPM
  const effectiveBpm = Math.min(bpm, DILLA_MAX_BPM);
  const stepDuration = (60 / effectiveBpm) / 4;
  const expectedGridTime = stepIdx * stepDuration;

  // Select swing multipliers based on mode
  let swingMultipliers;
  if (hihatMode === 'limp') {
    swingMultipliers = TRACK_SWING_MULTIPLIERS_LIMP;
  } else if (hihatMode === 'live') {
    swingMultipliers = TRACK_SWING_MULTIPLIERS_LIVE;
  } else {
    swingMultipliers = TRACK_SWING_MULTIPLIERS;
  }
  const swingMultiplier = swingMultipliers[targetPitch] || 0.5;

  // 1. Push/Pull: Dilla "Drunk" Formula (includes closed hi-hat drag in limp mode)
  const pushPullOffset = getPushPullOffset(targetPitch, humanizeAmount, hihatMode);

  // 2. Tuplet swing (apply only to off-beat steps)
  let tupletSwing = 0;
  if (stepIdx % 2 === 1) {
    const baseTupletOffset = getTupletOffset(stepDuration, humanizeAmount);
    const easedHumanize = 1 - Math.pow(1 - humanizeAmount, 3);
    tupletSwing = baseTupletOffset * easedHumanize * swingMultiplier * 0.15;
  }

  // 3. Find matching AI note (used for both timing and velocity)
  let aiNote = null;
  if (aiSequence && aiSequence.notes) {
    aiNote = aiSequence.notes.find(note => {
      if (note.pitch !== targetPitch) return false;
      const noteClosestStep = Math.round(note.startTime / stepDuration);
      return noteClosestStep === stepIdx;
    });
  }

  // 4. AI sequence offset (if available)
  let aiOffset = 0;
  if (aiNote) {
    aiOffset = (aiNote.startTime - expectedGridTime) * humanizeAmount * swingMultiplier;
  }

  // 5. Micro-variation: Use AI timing noise when available, fallback to formula
  // AI micro-timing is more organic than synthetic Math.random()
  let microVariation = 0;
  if (aiNote) {
    // Extract AI timing deviation as micro-variation (capped to ±10ms for safety)
    const aiMicroOffset = aiNote.startTime - (stepIdx * stepDuration);
    const cappedOffset = Math.max(-0.010, Math.min(0.010, aiMicroOffset));
    microVariation = cappedOffset * AI_BLEND_CONFIG.microTimingWeight * humanizeAmount;
  } else {
    // Fallback to formula-based random variation
    microVariation = getMicroVariation(humanizeAmount) * swingMultiplier;
  }

  // 6. Combine all timing offsets
  const rawOffset = pushPullOffset + aiOffset + tupletSwing + microVariation;

  // 7. Quantize to MPC 3000 resolution for authentic "chunky" feel
  const totalOffset = quantizeToMPCTicks(rawOffset, bpm);
  const humanizedTime = baseTime + totalOffset;

  // 8. Calculate velocity
  let finalVelocity = defaultVelocity;

  if (targetPitch === DRUM_PITCHES.HIHAT_CLOSED) {
    // Closed hi-hat uses AMPLITUDE MODULATION (formula-driven for Dilla friction)
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
  } else if (aiNote && aiNote.velocity && humanizeAmount > 0) {
    // Kick, snare, open hi-hat: Blend AI velocity with formula default
    // AI provides organic accent variation while formula maintains base level
    const aiVelocityWeight = AI_BLEND_CONFIG.velocityWeight * humanizeAmount;
    finalVelocity = (defaultVelocity * (1 - aiVelocityWeight)) +
                   (aiNote.velocity * aiVelocityWeight);
  }

  return {
    time: humanizedTime,
    velocity: Math.round(Math.max(1, Math.min(127, finalVelocity)))
  };
}
