/**
 *
 * This class has one job: Receive a command ("Play Kick at time 10.5") and make it happen using the Web Audio API.
 *
 */

export class AudioEngine {
  constructor(audioCtx) {
    this.audioContext = audioCtx;
  }
  scheduleNote(time, pitch) {
    const oscNode = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // 1. Init Parameters (Prevent time travel)
    // We use 'time' because that is when the note actually starts.
    oscNode.frequency.setValueAtTime(pitch, time);
    gainNode.gain.setValueAtTime(0, time);

    // 2. Attack (Fade In)
    // Ramp to full volume over 1 second
    gainNode.gain.linearRampToValueAtTime(1.0, time + 0.3);

    // 3. Release (Fade Out)
    // Ramp back to silent over the next second
    gainNode.gain.linearRampToValueAtTime(0, time + 0.3);

    // 4. Wiring
    oscNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // 5. Life Cycle
    oscNode.start(time);
    oscNode.stop(time + 0.3);
  }
}
