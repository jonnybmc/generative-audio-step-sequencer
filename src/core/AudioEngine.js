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
      // Play the sample
      this.playSample(sample, time, gain);
    } else {
      // Fallback to oscillator if sample not loaded
      this.playOscillator(time, pitch, gain);
    }
  }

  /**
   * Play an audio sample at a specific time with gain control
   */
  playSample(buffer, time, gain) {
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = buffer;
    gainNode.gain.setValueAtTime(gain, time);

    source.connect(gainNode);
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
   * Get the humanized time and velocity for a note
   * @param {number} trackIdx - Track index (0-3)
   * @param {number} stepIdx - Step index (0-15)
   * @param {number} baseTime - The quantized grid time (AudioContext absolute time)
   * @param {Object} aiSequence - The AI-generated sequence with timing/velocity
   * @param {number} humanizeAmount - Blend amount (0.0 = grid, 1.0 = full AI groove)
   * @param {Object} pitchMap - Map of track index to MIDI pitch
   * @param {number} bpm - Current tempo
   * @returns {Object} { time: number, velocity: number }
   */
  getHumanizedNote(trackIdx, stepIdx, baseTime, aiSequence, humanizeAmount, pitchMap, bpm) {
    const defaultVelocity = 100;
    const targetPitch = pitchMap[trackIdx];

    // Hi-hat closed pitch (track 2) - only this gets velocity variation
    const HIHAT_CLOSED_PITCH = 42;

    // 1. Safety Checks - return grid time and default velocity
    if (!aiSequence || !aiSequence.notes || humanizeAmount === 0) {
      return { time: baseTime, velocity: defaultVelocity };
    }

    // Calculate step duration in seconds
    const stepDuration = (60 / bpm) / 4;
    // Expected grid time for this step (song-relative: 0, 0.125, 0.25...)
    const expectedGridTime = stepIdx * stepDuration;

    // 2. Find the AI note by matching pitch and finding the note closest to this step
    const aiNote = aiSequence.notes.find(note => {
      if (note.pitch !== targetPitch) return false;
      const noteClosestStep = Math.round(note.startTime / stepDuration);
      return noteClosestStep === stepIdx;
    });

    // 3. If no matching note found, stick to the grid with default velocity
    if (!aiNote) {
      return { time: baseTime, velocity: defaultVelocity };
    }

    // 4. Calculate humanized timing using LERP (applies to ALL instruments)
    const aiOffset = aiNote.startTime - expectedGridTime;
    const humanizedTime = baseTime + (aiOffset * humanizeAmount);

    // 5. Calculate velocity - ONLY hi-hat closed gets velocity variation
    // Kick and snare stay punchy at full velocity (like a real drummer)
    let finalVelocity = defaultVelocity;
    if (targetPitch === HIHAT_CLOSED_PITCH) {
      const aiVelocity = aiNote.velocity !== undefined ? aiNote.velocity : defaultVelocity;
      finalVelocity = defaultVelocity + (aiVelocity - defaultVelocity) * humanizeAmount;
    }

    return {
      time: humanizedTime,
      velocity: Math.round(Math.max(1, finalVelocity))
    };
  }

  /**
   * Generate hi-hat ghost notes for that soul/hip-hop pocket feel
   * Real drummers add subtle hi-hat ghost notes with triplet feels and swing
   * @param {Object} aiSequence - The AI-generated sequence
   * @param {Object} originalSteps - The original step pattern from the store
   * @param {number} bpm - Current tempo
   * @param {number} humanizeAmount - Controls how many ghost notes appear (0-1)
   * @returns {Array} Array of ghost notes to play
   */
  extractGhostNotes(aiSequence, originalSteps, bpm, humanizeAmount) {
    // No ghost notes below 30% humanization
    if (humanizeAmount < 0.3) {
      return [];
    }

    const stepDuration = (60 / bpm) / 4; // 16th note duration
    const tripletOffset = stepDuration * 0.667; // Triplet feel offset (2/3 of a 16th)
    const ghostNotes = [];
    const HIHAT_CLOSED_PITCH = 42;

    // Hip-hop/Soul hi-hat ghost note positions with musical context:
    // These create that "in the pocket" feel with triplet swings
    const ghostPatterns = [
      // Triplet ghosts before main beats (creates anticipation/swing)
      { step: 0, offset: -tripletOffset * 0.5, weight: 0.4, desc: 'swing into beat 1' },
      { step: 4, offset: -tripletOffset * 0.5, weight: 0.5, desc: 'swing into beat 2' },
      { step: 8, offset: -tripletOffset * 0.5, weight: 0.4, desc: 'swing into beat 3' },
      { step: 12, offset: -tripletOffset * 0.5, weight: 0.5, desc: 'swing into beat 4' },

      // Late triplet ghosts (Dilla-style lazy pocket)
      { step: 2, offset: tripletOffset * 0.3, weight: 0.6, desc: 'lazy e of 1' },
      { step: 6, offset: tripletOffset * 0.4, weight: 0.7, desc: 'lazy e of 2' },
      { step: 10, offset: tripletOffset * 0.3, weight: 0.6, desc: 'lazy e of 3' },
      { step: 14, offset: tripletOffset * 0.4, weight: 0.7, desc: 'lazy e of 4' },

      // Subtle 16th note fills (very quiet, adds texture)
      { step: 1, offset: 0, weight: 0.3, desc: '16th fill' },
      { step: 3, offset: 0, weight: 0.35, desc: '16th fill' },
      { step: 5, offset: 0, weight: 0.3, desc: '16th fill' },
      { step: 7, offset: 0, weight: 0.4, desc: '16th fill before snare' },
      { step: 9, offset: 0, weight: 0.3, desc: '16th fill' },
      { step: 11, offset: 0, weight: 0.35, desc: '16th fill' },
      { step: 13, offset: 0, weight: 0.3, desc: '16th fill' },
      { step: 15, offset: 0, weight: 0.45, desc: '16th fill end of bar' },
    ];

    ghostPatterns.forEach(pattern => {
      const stepId = `track-2_${pattern.step}`; // Track 2 = hi-hat closed

      // Skip if there's already a hi-hat hit on this step
      if (originalSteps[stepId]?.active) return;

      // Probability based on humanize amount and pattern weight
      // Higher weight = more likely to appear
      // At 30% humanize: only high-weight patterns appear occasionally
      // At 100% humanize: most patterns appear
      const baseProbability = (humanizeAmount - 0.3) * 1.4; // 0 to ~1.0
      const probability = baseProbability * pattern.weight;

      if (Math.random() < probability) {
        // Calculate ghost note time with triplet/swing offset
        const baseTime = pattern.step * stepDuration;
        const swingOffset = pattern.offset * humanizeAmount; // More swing at higher humanize

        // Add tiny human variation (-5ms to +5ms)
        const humanVariation = (Math.random() - 0.5) * 0.01;

        ghostNotes.push({
          pitch: HIHAT_CLOSED_PITCH,
          step: pattern.step,
          startTime: baseTime + swingOffset + humanVariation,
          // Very soft velocity (20-45) - ghost hi-hats should be felt not heard
          velocity: Math.round(20 + (pattern.weight * 15) + (Math.random() * 10))
        });
      }
    });

    return ghostNotes;
  }
}
