// grooveWorker.js

// 1. Mocks for Environment Compatibility
self.window = self;
self.OfflineAudioContext = function() {};
self.AudioContext = function() {};

// 2. Verified Local Imports
importScripts('../lib/tf.min.js');
importScripts('../lib/magenta_core.js');
importScripts('../lib/music_vae.js');

// 3. Initialize the HUMANIZE Model
// IMPORTANT: Using groovae_2bar_humanize - this model is specifically trained to
// take QUANTIZED input and output HUMANIZED timing + velocity
// Regular groovae models just reconstruct - they don't add groove to quantized input!
const HUMANIZE_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/groovae_2bar_humanize';
const model = new music_vae.MusicVAE(HUMANIZE_CHECKPOINT);

model.initialize().then(() => {
    console.log("Worker: GrooVAE Humanize model is ready!");
    self.postMessage({ type: 'READY' });
});

// 4. Main Message Handler
self.onmessage = async function(e) {
    if (e.data.type === 'HUMANIZE') {
        const { bpm, steps, humanizeValue = 0 } = e.data.payload;

        const rawSeq = inflateStepsToSequence(steps, bpm);

        // Validation: Check if the user has actually toggled any notes on
        if (rawSeq.notes.length === 0) {
            console.warn("Worker: No notes found. Skipping AI inference.");
            self.postMessage({
                type: 'HUMANIZED_RESULT',
                payload: rawSeq
            });
            return;
        }

        // Quantize with 4 steps per quarter note (16th notes)
        const stepsPerQuarter = 4;
        const quantizedSeq = core.sequences.quantizeNoteSequence(rawSeq, stepsPerQuarter);

        // If humanize is 0, skip AI processing entirely - return quantized (rigid) sequence
        if (humanizeValue === 0) {
            console.log("Worker: Humanize at 0% - returning rigid/quantized sequence");
            self.postMessage({
                type: 'HUMANIZED_RESULT',
                payload: quantizedSeq
            });
            return;
        }

        // Scale humanizeValue (1-100) to temperature (0.4-1.2)
        // 0.4 = subtle, tight humanization
        // 1.2 = expressive with natural variation
        const temperature = 0.4 + (humanizeValue / 100) * 0.8;

        try {
            // Encode the quantized (robotic) sequence
            const z = await model.encode([quantizedSeq]);

            // Decode with temperature - the HUMANIZE model will output:
            // - Micro-timing offsets (notes slightly before/after the grid)
            // - Velocity variations (accents, ghost notes)
            const humanizedResult = await model.decode(z, temperature, undefined, stepsPerQuarter, bpm);

            // Clean up tensor memory
            z.dispose();

            const outputSeq = humanizedResult[0];

            // Debug: Log timing and velocity differences
            console.log("Worker: Temperature used:", temperature.toFixed(2));
            console.log("Worker: Input (quantized) notes:");
            quantizedSeq.notes.forEach(n => {
                const gridTime = (n.quantizedStartStep / stepsPerQuarter) * (60 / bpm);
                console.log(`  Pitch ${n.pitch}: step ${n.quantizedStartStep}, gridTime ${gridTime.toFixed(4)}s, vel ${n.velocity}`);
            });

            console.log("Worker: Output (humanized) notes:");
            outputSeq.notes.forEach(n => {
                // Calculate which grid step this note is closest to
                const closestStep = Math.round((n.startTime || 0) / (60 / bpm / 4));
                const expectedGridTime = closestStep * (60 / bpm / 4);
                const offset = ((n.startTime || 0) - expectedGridTime) * 1000;
                console.log(`  Pitch ${n.pitch}: startTime ${n.startTime?.toFixed(4)}s, step ~${closestStep}, offset ${offset.toFixed(2)}ms, vel ${n.velocity}`);
            });

            self.postMessage({
                type: 'HUMANIZED_RESULT',
                payload: outputSeq
            });
        } catch (error) {
            console.error("Worker: Humanization failed:", error);
            // Fallback to quantized sequence
            self.postMessage({
                type: 'HUMANIZED_RESULT',
                payload: quantizedSeq
            });
        }
    }
};

// 5. The "Inflation" Translator
function inflateStepsToSequence(steps, bpm) {
    const stepDuration = (60 / bpm) / 4; 
    const notes = [];
    const pitchMap = { 0: 36, 1: 38, 2: 42, 3: 46 };

    Object.keys(steps).forEach(id => {
        if (steps[id].active) {
            const [trackPart, stepPart] = id.split('_');
            const trackIdx = parseInt(trackPart.replace('track-', ''));
            const stepIdx = parseInt(stepPart);

            notes.push({
                pitch: pitchMap[trackIdx],
                startTime: stepIdx * stepDuration,
                endTime: (stepIdx + 1) * stepDuration,
                velocity: 100 // AI will override this in the result
            });
        }
    });

    return {
        notes,
        totalTime: 16 * stepDuration,
        tempos: [{ qpm: bpm }]
    };
}