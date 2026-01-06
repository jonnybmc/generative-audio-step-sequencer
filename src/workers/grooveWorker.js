// grooveWorker.js

// 1. Mocks (Only if needed for the specific core build, but good for safety)
self.window = self;

// 2. Imports - using the local files we verified
importScripts('../lib/tf.min.js');
importScripts('../lib/magenta_core.js');
importScripts('../lib/music_vae.js');

// 3. Initialize Model
const model = new music_vae.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/groovae_4bar');

model.initialize().then(() => {
    console.log("Worker: GrooveVAE Brain is ready!");
    self.postMessage({ type: 'READY' });
});

// 4. Main Message Handler
self.onmessage = async function(e) {
    if (e.data.type === 'HUMANIZE') {
        const { bpm, steps } = e.data.payload;

        // Step A: Convert your App State (grid) to a NoteSequence (time-based)
        const rawSeq = inflateStepsToSequence(steps, bpm);

        // Step B: Quantize (The AI needs to know the "intended" grid)
        // 'core' is the global variable from magenta_core.js
        const quantizedSeq = core.sequences.quantizeNoteSequence(rawSeq, 4);

        // Step C: Humanize (Inference)
        // For GrooveVAE, we use 'sample' to generate variations based on the input
        // We'll refine the specific 'humanize' method in the next step
        const result = await model.sample(1, 1.0); 

        self.postMessage({
            type: 'HUMANIZED_RESULT',
            payload: result[0]
        });
    }
};

// 5. Translation Helper
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
                velocity: 100 
            });
        }
    });

    return {
        notes,
        totalTime: 16 * stepDuration,
        tempos: [{ qpm: bpm }]
    };
}