/**
 *
 * This class has one job: Receive a command ("Play Kick at time 10.5") and make it happen using the Web Audio API.
 * Now supports loading and playing drum samples with velocity control.
 *
 */

export class AudioEngine {
  constructor(audioCtx) {
    this.audioContext = audioCtx;
    this.samples = {}; // Will hold decoded AudioBuffers
    this.samplesLoaded = false;

    // Map MIDI pitches to sample names
    this.pitchToSample = {
      36: 'kick',
      38: 'snare',
      42: 'hihat-closed',
      46: 'hihat-open'
    };
  }

  /**
   * Load all drum samples
   * Call this after user interaction (e.g., after clicking play)
   */
  async loadSamples() {
    if (this.samplesLoaded) return;

    const sampleFiles = {
      'kick': './samples/kick.wav',
      'snare': './samples/snare.wav',
      'hihat-closed': './samples/hihat-closed.wav',
      'hihat-open': './samples/hihat-open.wav'
    };

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
    console.log('All samples loaded:', Object.keys(this.samples));
  }

  /**
   * Schedule a note to play at a specific time
   * @param {number} time - AudioContext time to play the note
   * @param {number} pitch - MIDI pitch number
   * @param {number} velocity - MIDI velocity (0-127), defaults to 100
   */
  scheduleNote(time, pitch, velocity = 100) {
    const sampleName = this.pitchToSample[pitch];
    const sample = sampleName ? this.samples[sampleName] : null;

    // Convert MIDI velocity (0-127) to gain (0.0-1.0)
    const normalizedVelocity = velocity / 127;
    const gain = Math.pow(normalizedVelocity, 1.5); // Exponential curve for natural dynamics

    if (sample) {
      // Play the sample with velocity-based filtering
      this.playSample(sample, time, gain, velocity);
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
   */
  playSample(buffer, time, gain, velocity = 100) {
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    const filterNode = this.audioContext.createBiquadFilter();

    source.buffer = buffer;
    gainNode.gain.setValueAtTime(gain, time);

    // Velocity-to-Filter mapping (Dilla technique)
    // Low velocity ghost notes get darker/more muffled timbre
    // This simulates center-of-head hits vs rim hits
    filterNode.type = 'lowpass';
    const minCutoff = 800;    // Very muffled for ghost notes (vel ~20-30)
    const maxCutoff = 20000;  // Full brightness for main hits (vel 100+)

    // Map velocity (1-127) to cutoff frequency using exponential curve
    // Exponential curve keeps main hits bright while making ghosts progressively darker
    const normalizedVel = velocity / 127;
    const cutoff = minCutoff + (maxCutoff - minCutoff) * Math.pow(normalizedVel, 2);

    filterNode.frequency.setValueAtTime(cutoff, time);
    filterNode.Q.setValueAtTime(0.7, time); // Gentle resonance, no harshness

    // Signal chain: source → filter → gain → destination
    source.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.start(time);
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

    oscNode.start(time);
    oscNode.stop(time + 0.1);
  }

  calculateFrequency(pitch) {
    const adjustedPitch = pitch + 24;
    return 440 * Math.pow(2, (adjustedPitch - 69) / 12);
  }

  /**
   * Per-track swing multipliers - CORRECTED based on Dilla/MPC analysis
   * Kick swings hardest (it's the "drunk" element)
   * Hi-hats stay RIGID to create friction against lazy kick
   */
  trackSwingMultiplier = {
    36: 1.0,   // Kick - MAXIMUM swing (the drunk, dragging element)
    38: 0.2,   // Snare - minimal swing (anchor/slingshot)
    42: 0.3,   // Hi-hat closed - mostly RIGID (creates friction)
    46: 0.4    // Hi-hat open - slight swing
  };

  /**
   * Calculate tuplet offset based on humanize level
   * CORRECTED: Uses Dilla sweet spot (57%-60%), NOT triplet (66.7%)
   * Triplet swing is too "bouncy" - Dilla's feel is more "limping"
   * @param {number} stepDuration - Duration of one 16th note in seconds
   * @param {number} humanizeAmount - 0.0 to 1.0
   * @returns {number} Offset in seconds for tuplet swing
   */
  getTupletOffset(stepDuration, humanizeAmount) {
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
      // Creates subtle "stumble" at lower humanize
      const blend = humanizeAmount / 0.5;
      const straight = stepDuration * 0.5;
      const septuplet = stepDuration * 0.57;
      return straight + (septuplet - straight) * blend;
    } else {
      // Blend septuplet (57%) → quintuplet (60%)
      // Full "drunk" feel at high humanize
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
  getMicroVariation(humanizeAmount) {
    // ±2ms at low humanize, ±8ms at high humanize
    const maxVariationMs = 2 + (humanizeAmount * 6);
    return ((Math.random() - 0.5) * 2 * maxVariationMs) / 1000;
  }

  /**
   * Quantize offset to MPC 3000 resolution (96 PPQN)
   * This creates the "chunky", committed feel of hardware timing
   * Each tick at 88 BPM ≈ 7.1ms - significant, audible displacement
   * @param {number} offsetSeconds - The offset to quantize (in seconds)
   * @param {number} bpm - Current tempo
   * @returns {number} Quantized offset in seconds
   */
  quantizeToMPCTicks(offsetSeconds, bpm) {
    // MPC 3000 has 96 pulses per quarter note
    const PPQN = 96;
    // Duration of one tick in seconds
    const tickDuration = (60 / bpm) / PPQN;
    // Convert offset to ticks, round to nearest tick, convert back
    const ticks = Math.round(offsetSeconds / tickDuration);
    return ticks * tickDuration;
  }

  /**
   * Gaussian (normal) distribution random number
   * Uses Box-Muller transform for natural-sounding variation
   * @returns {number} Random number with mean 0, stdDev ~1
   */
  gaussianRandom() {
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
  gaussianVelocity(target, stdDev) {
    const variation = this.gaussianRandom() * stdDev;
    return Math.round(Math.max(1, Math.min(127, target + variation)));
  }

  /**
   * Gaussian probability check (more natural than uniform)
   * @param {number} probability - Base probability (0-1)
   * @returns {boolean} Whether the event should occur
   */
  gaussianProbability(probability) {
    // Use absolute value of gaussian for one-sided distribution
    const roll = Math.abs(this.gaussianRandom()) / 3; // Normalize to ~0-1 range
    return roll < probability;
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
   * @param {Object} trackSettings - Per-track humanize settings (optional)
   * @returns {Object} { time: number, velocity: number }
   */
  getHumanizedNote(trackIdx, stepIdx, baseTime, aiSequence, humanizeAmount, pitchMap, bpm, trackSettings = null) {
    const defaultVelocity = 100;
    const targetPitch = pitchMap[trackIdx];

    // MIDI pitches
    const KICK_PITCH = 36;
    const SNARE_PITCH = 38;
    const HIHAT_CLOSED_PITCH = 42;

    // Get per-track settings (with defaults)
    const settings = trackSettings?.[trackIdx] || { humanize: 100, swingEnabled: true };

    // If swing is bypassed for this track, return grid time
    if (!settings.swingEnabled) {
      return { time: baseTime, velocity: defaultVelocity };
    }

    // Calculate EFFECTIVE humanize for this track
    // Main dial × per-track dial (both 0-100, convert to 0-1)
    const effectiveHumanize = humanizeAmount * (settings.humanize / 100);

    // 1. Safety Checks - return grid time and default velocity
    if (effectiveHumanize === 0) {
      return { time: baseTime, velocity: defaultVelocity };
    }

    // Calculate step duration in seconds
    const stepDuration = (60 / bpm) / 4;
    // Expected grid time for this step (song-relative: 0, 0.125, 0.25...)
    const expectedGridTime = stepIdx * stepDuration;

    // 2. Get per-track swing multiplier (kick anchors, hi-hat swings hardest)
    const swingMultiplier = this.trackSwingMultiplier[targetPitch] || 0.5;

    // 3. PUSH/PULL: The Dilla "Drunk" Formula (CORRECTED)
    // Based on MPC 3000 analysis: Kick DRAGS (late), Snare ANCHORS (on-grid/early)
    // This creates the "falling" sensation with the kick, "slingshot" back with snare
    let pushPullOffset = 0;

    if (targetPitch === KICK_PITCH) {
      // KICK: Always LATE (positive offset = drag behind the grid)
      // +15ms to +45ms late, scaled by humanize amount
      // At 88 BPM, stepDuration ≈ 170ms, so 0.15 * 170 ≈ 25ms base drag
      const maxDragMs = 45; // Maximum drag in ms
      const minDragMs = 15; // Minimum drag in ms
      const dragRange = maxDragMs - minDragMs;
      const baseDrag = (minDragMs + (dragRange * effectiveHumanize)) / 1000; // Convert to seconds
      // Add random variation (±20%)
      pushPullOffset = baseDrag * (0.8 + Math.random() * 0.4);
    } else if (targetPitch === SNARE_PITCH) {
      // SNARE: On-grid or slightly EARLY (negative offset = anchor/rush)
      // 0ms to -10ms, provides the "slingshot" reference point
      const maxRushMs = 10 * effectiveHumanize; // Scale with humanize
      // Mostly on-grid, occasionally slightly early
      pushPullOffset = -(Math.random() * maxRushMs) / 1000; // 0 to -10ms
    }
    // Hi-hats: No push/pull offset - they stay rigid for FRICTION against lazy kick

    // 4. Calculate tuplet-based swing offset
    // Apply only to off-beat steps (odd steps: 1, 3, 5, 7, 9, 11, 13, 15)
    let tupletSwing = 0;
    if (stepIdx % 2 === 1) {
      // Get the tuplet offset (triplet → quintuplet → septuplet based on humanize)
      const baseTupletOffset = this.getTupletOffset(stepDuration, effectiveHumanize);
      // Scale by humanize amount and track multiplier
      // Use easing for natural feel: ease-out cubic
      const easedHumanize = 1 - Math.pow(1 - effectiveHumanize, 3);
      tupletSwing = baseTupletOffset * easedHumanize * swingMultiplier * 0.15;
    }

    // 5. Find the AI note by matching pitch and finding the note closest to this step
    let aiOffset = 0;
    if (aiSequence && aiSequence.notes) {
      const aiNote = aiSequence.notes.find(note => {
        if (note.pitch !== targetPitch) return false;
        const noteClosestStep = Math.round(note.startTime / stepDuration);
        return noteClosestStep === stepIdx;
      });

      if (aiNote) {
        // Get AI timing offset and scale by track multiplier
        aiOffset = (aiNote.startTime - expectedGridTime) * effectiveHumanize * swingMultiplier;
      }
    }

    // 6. Add micro-variation (human inconsistency)
    const microVariation = this.getMicroVariation(effectiveHumanize) * swingMultiplier;

    // 7. Combine all timing offsets: push/pull + AI groove + tuplet swing + micro-variation
    const rawOffset = pushPullOffset + aiOffset + tupletSwing + microVariation;

    // 8. Quantize to MPC 3000 resolution (96 PPQN) for authentic "chunky" feel
    // This makes timing displacements committed and audible, not smooth/subtle
    const totalOffset = this.quantizeToMPCTicks(rawOffset, bpm);
    const humanizedTime = baseTime + totalOffset;

    // 9. Calculate velocity - Hi-hat uses AMPLITUDE MODULATION for pump effect
    // Kick and snare stay punchy at full velocity (like a real drummer)
    let finalVelocity = defaultVelocity;

    if (targetPitch === HIHAT_CLOSED_PITCH) {
      // AMPLITUDE MODULATION: Creates "pumping" head-nod feel
      // Downbeats LOUD, upbeats SOFT - simulates downstroke/upstroke mechanics
      const isDownbeat = (stepIdx % 4 === 0);  // Steps 0, 4, 8, 12
      const isUpbeat = (stepIdx % 4 === 2);    // Steps 2, 6, 10, 14
      // isWeak = odd steps (1, 3, 5, 7, 9, 11, 13, 15) - handled by else

      if (effectiveHumanize === 0) {
        // At 0% humanize, flat velocity
        finalVelocity = defaultVelocity;
      } else if (isDownbeat) {
        // Downbeats: ACCENTED (100-127)
        finalVelocity = 100 + (effectiveHumanize * 27);
      } else if (isUpbeat) {
        // Upbeats: GHOSTED (50-70)
        finalVelocity = 70 - (effectiveHumanize * 20);
      } else {
        // Weak 16ths (odd steps): VERY SOFT (40-60)
        finalVelocity = 60 - (effectiveHumanize * 20);
      }

      // Add Gaussian variation for natural feel (±10 velocity)
      finalVelocity += this.gaussianRandom() * 10 * effectiveHumanize;
    }

    return {
      time: humanizedTime,
      velocity: Math.round(Math.max(1, Math.min(127, finalVelocity)))
    };
  }

  /**
   * Extract ghost notes - SNARE DRAGS and KICK STUMBLES
   * Ghost notes are "connective tissue" that smooths the groove
   * Hi-hat "ghosting" is now done via amplitude modulation in getHumanizedNote()
   * @param {Object} aiSequence - The AI-generated sequence (unused, kept for API compat)
   * @param {Object} originalSteps - The original step pattern from the store
   * @param {number} bpm - Current tempo
   * @param {number} humanizeAmount - Controls ghost note density (0-1)
   * @param {Object} trackSettings - Per-track humanize settings (optional)
   * @returns {Array} Array of ghost notes to play
   */
  extractGhostNotes(aiSequence, originalSteps, bpm, humanizeAmount, trackSettings = null) {
    // No ghost notes below 30% humanization
    if (humanizeAmount < 0.3) {
      return [];
    }

    const stepDuration = (60 / bpm) / 4; // 16th note duration
    const ghostNotes = [];

    // 1. SNARE GHOSTS (30%+ humanize) - Drags and ruffs
    // Check if snare ghosts are enabled (track 1)
    const snareGhostsEnabled = trackSettings?.[1]?.ghostsEnabled ?? true;
    if (snareGhostsEnabled) {
      // Calculate effective humanize for snare track
      const snareHumanizeMult = trackSettings?.[1]?.humanize ?? 100;
      const snareEffectiveHumanize = humanizeAmount * (snareHumanizeMult / 100);
      if (snareEffectiveHumanize >= 0.3) {
        ghostNotes.push(...this.generateSnareGhosts(originalSteps, stepDuration, snareEffectiveHumanize, bpm));
      }
    }

    // 2. KICK GHOSTS (50%+ humanize) - Stumbles
    // Check if kick ghosts are enabled (track 0)
    const kickGhostsEnabled = trackSettings?.[0]?.ghostsEnabled ?? true;
    if (kickGhostsEnabled && humanizeAmount >= 0.5) {
      // Calculate effective humanize for kick track
      const kickHumanizeMult = trackSettings?.[0]?.humanize ?? 100;
      const kickEffectiveHumanize = humanizeAmount * (kickHumanizeMult / 100);
      if (kickEffectiveHumanize >= 0.5) {
        ghostNotes.push(...this.generateKickGhosts(originalSteps, stepDuration, kickEffectiveHumanize, bpm));
      }
    }

    // 3. CLOSED HI-HAT GHOSTS (track 2) - Skip ghosts only
    const closedHihatGhostsEnabled = trackSettings?.[2]?.ghostsEnabled ?? false;
    if (closedHihatGhostsEnabled && humanizeAmount >= 0.4) {
      const closedHihatMult = trackSettings?.[2]?.humanize ?? 100;
      const closedHihatEffective = humanizeAmount * (closedHihatMult / 100);
      if (closedHihatEffective >= 0.4) {
        ghostNotes.push(...this.generateClosedHiHatGhosts(originalSteps, stepDuration, closedHihatEffective, bpm));
      }
    }

    // 4. OPEN HI-HAT GHOSTS (track 3) - Slurp ghosts only
    const openHihatGhostsEnabled = trackSettings?.[3]?.ghostsEnabled ?? false;
    if (openHihatGhostsEnabled && humanizeAmount >= 0.6) {
      const openHihatMult = trackSettings?.[3]?.humanize ?? 100;
      const openHihatEffective = humanizeAmount * (openHihatMult / 100);
      if (openHihatEffective >= 0.6) {
        ghostNotes.push(...this.generateOpenHiHatGhosts(originalSteps, stepDuration, openHihatEffective, bpm));
      }
    }

    return ghostNotes;
  }

  /**
   * Generate SNARE ghost notes - the "drag" and "ruff"
   * Simulates drummer's left hand performing rudiments before/after backbeat
   * @returns {Array} Snare ghost notes
   */
  generateSnareGhosts(originalSteps, stepDuration, humanizeAmount, bpm) {
    const SNARE_PITCH = 38;
    const ghosts = [];

    // Main snare positions (backbeats: beats 2 and 4)
    const mainSnareSteps = [4, 12];

    mainSnareSteps.forEach(mainStep => {
      // === PRE-BEAT DRAG (step before main snare) ===
      // Creates "flam" effect - too wide for standard flam, too tight for strict 16th
      const preDragStep = mainStep - 1; // Steps 3 and 11

      if (!originalSteps[`track-1_${preDragStep}`]?.active) {
        // Probability increases with humanize (40% at full humanize)
        if (this.gaussianProbability(0.4 * humanizeAmount)) {
          // LATE timing - drag toward the main snare hit
          const lateOffset = stepDuration * 0.3 * humanizeAmount;
          const baseTime = preDragStep * stepDuration + lateOffset;
          const quantizedTime = this.quantizeToMPCTicks(baseTime, bpm);

          ghosts.push({
            pitch: SNARE_PITCH,
            step: preDragStep,
            startTime: quantizedTime,
            // Velocity: 25-35% of main (very soft, muffled)
            velocity: this.gaussianVelocity(30, 5)
          });
        }
      }

      // === POST-BEAT CHATTER (step after main snare) ===
      // Quieter, more subtle "release" after the main hit
      const postChatterStep = mainStep + 1; // Steps 5 and 13

      if (!originalSteps[`track-1_${postChatterStep}`]?.active) {
        // Lower probability than pre-drag (30% at full humanize)
        if (this.gaussianProbability(0.3 * humanizeAmount)) {
          const lateOffset = stepDuration * 0.2 * humanizeAmount;
          const baseTime = postChatterStep * stepDuration + lateOffset;
          const quantizedTime = this.quantizeToMPCTicks(baseTime, bpm);

          ghosts.push({
            pitch: SNARE_PITCH,
            step: postChatterStep,
            startTime: quantizedTime,
            // Slightly softer than pre-drag
            velocity: this.gaussianVelocity(28, 4)
          });
        }
      }
    });

    return ghosts;
  }

  /**
   * Generate KICK ghost notes - the "stumble"
   * Creates "falling down stairs" sensation, destabilizes groove just enough
   * Ghost kicks are LOUDER than snare ghosts (need to move the subwoofer)
   * @returns {Array} Kick ghost notes
   */
  generateKickGhosts(originalSteps, stepDuration, humanizeAmount, bpm) {
    const KICK_PITCH = 36;
    const ghosts = [];

    // Ghost kick candidates - weak 16ths ("e" and "a" subdivisions)
    // These create clusters of low-end before the next downbeat
    const ghostKickCandidates = [
      { step: 15, weight: 0.7 }, // "a" of beat 4 - MOST COMMON, leads into next bar
      { step: 7, weight: 0.4 },  // "a" of beat 2 - before snare backbeat
      { step: 3, weight: 0.3 },  // "a" of beat 1 - subtle stumble
      { step: 11, weight: 0.35 }, // "a" of beat 3 - before final snare
    ];

    ghostKickCandidates.forEach(candidate => {
      // Skip if there's already a kick on this step
      if (originalSteps[`track-0_${candidate.step}`]?.active) return;

      // Scale probability by weight and humanize amount (starting from 50%)
      const effectiveHumanize = (humanizeAmount - 0.5) * 2; // 0 at 50%, 1 at 100%
      const probability = candidate.weight * effectiveHumanize;

      if (this.gaussianProbability(probability)) {
        // MORE LATE than main kicks - creates "cluster" effect
        // Ghost kicks drag even more than regular kicks
        const lateOffset = stepDuration * 0.25 * humanizeAmount;
        const baseTime = candidate.step * stepDuration + lateOffset;
        const quantizedTime = this.quantizeToMPCTicks(baseTime, bpm);

        ghosts.push({
          pitch: KICK_PITCH,
          step: candidate.step,
          startTime: quantizedTime,
          // Velocity: 60-80 - LOUDER than snare ghosts (moves the subwoofer)
          velocity: this.gaussianVelocity(70, 10)
        });
      }
    });

    return ghosts;
  }

  /**
   * Generate CLOSED HI-HAT ghost notes - the "skip"
   * Creates shuffle/friction texture that contrasts with straight main hats
   * Controlled independently by track 2 (closed hi-hat) settings
   * @returns {Array} Closed hi-hat ghost notes (pitch 42 only)
   */
  generateClosedHiHatGhosts(originalSteps, stepDuration, humanizeAmount, bpm) {
    const HIHAT_CLOSED = 42;
    const ghosts = [];

    // SKIPPING GHOSTS - "e" and "a" 16th notes (odd steps: 1,3,5,7,9,11,13,15)
    // Key Dilla technique: main hats straight, ghost hats heavily swung
    const skipCandidates = [1, 3, 5, 7, 9, 11, 13, 15];
    skipCandidates.forEach(step => {
      // Skip if there's already a closed hat on this step
      if (originalSteps[`track-2_${step}`]?.active) return;

      // 30% probability at full humanize, scales down
      if (this.gaussianProbability(0.3 * humanizeAmount)) {
        // Heavy swing: +20ms to +35ms late (even if main hats are straight)
        const lateOffset = (20 + Math.random() * 15) / 1000;
        const baseTime = step * stepDuration + lateOffset;

        ghosts.push({
          pitch: HIHAT_CLOSED,
          step: step,
          startTime: this.quantizeToMPCTicks(baseTime, bpm),
          // Very quiet: velocity 20-40, less than 50% of main hat
          velocity: this.gaussianVelocity(30, 8)
        });
      }
    });

    return ghosts;
  }

  /**
   * Generate OPEN HI-HAT ghost notes - the "slurp"
   * Creates "breathing" texture - short open hat choked by following kick
   * Controlled independently by track 3 (open hi-hat) settings
   * @returns {Array} Open hi-hat ghost notes (pitch 46 only)
   */
  generateOpenHiHatGhosts(originalSteps, stepDuration, humanizeAmount, bpm) {
    const HIHAT_OPEN = 46;
    const ghosts = [];

    // SLURP GHOSTS - Open hat on "a" before downbeats (steps 3, 7, 11, 15)
    const slurpCandidates = [3, 7, 11, 15];
    slurpCandidates.forEach(step => {
      // Skip if there's already an open hat on this step
      if (originalSteps[`track-3_${step}`]?.active) return;
      // Also skip if there's a closed hat (would conflict)
      if (originalSteps[`track-2_${step}`]?.active) return;

      // 25% probability at full humanize
      if (this.gaussianProbability(0.25 * humanizeAmount)) {
        // Slight delay to emphasize the "sucking" before kick
        const lateOffset = stepDuration * 0.15;
        const baseTime = step * stepDuration + lateOffset;

        ghosts.push({
          pitch: HIHAT_OPEN,
          step: step,
          startTime: this.quantizeToMPCTicks(baseTime, bpm),
          // Mid velocity: audible but not dominant (60-80)
          velocity: this.gaussianVelocity(70, 10)
        });
      }
    });

    return ghosts;
  }
}
