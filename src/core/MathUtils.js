/**
 * Math utilities for audio processing
 * Gaussian distribution functions for natural-sounding variation
 */

/**
 * Gaussian (normal) distribution random number
 * Uses Box-Muller transform for natural-sounding variation
 * @returns {number} Random number with mean 0, stdDev ~1
 */
export function gaussianRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Generate velocity using Gaussian distribution
 * @param {number} target - Target velocity (center of distribution)
 * @param {number} stdDev - Standard deviation (spread)
 * @returns {number} Velocity value clamped to 1-127
 */
export function gaussianVelocity(target, stdDev) {
  const variation = gaussianRandom() * stdDev;
  return Math.round(Math.max(1, Math.min(127, target + variation)));
}

/**
 * Gaussian probability check (more natural than uniform)
 * @param {number} probability - Base probability (0-1)
 * @returns {boolean} Whether the event should occur
 */
export function gaussianProbability(probability) {
  // Use absolute value of gaussian for one-sided distribution
  const roll = Math.abs(gaussianRandom()) / 3; // Normalize to ~0-1 range
  return roll < probability;
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
