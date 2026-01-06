// we need something to track time and that will serve to update all other subling classes e.g. hardware contexct

export class Clock {
    /**
     * 
     * @param {Object} dependencies - Dependency Injection Conatiner
     * @param {AudioContext} dependencies.audioContext - Web Audio APi which is the browser audio host
     * @param {Function} dependencies.getTempo
     * @param {Function} dependencies.onTick - Callback: (step, time) => void
     */

    constructor( {audioContext, getTempo, onTick } ) {
        //initilisation of contexts and state stores and private functions to Clock class

        this.audioContext = audioContext;
        this.getTempo = getTempo;
        this.onTick = onTick;

        //config
        this.lookahead = 25.0 // call scheduler every 25 miulliseconds
        this.scheduleAheadTime = 0.1  // scheduler time for when to schedule the next note of audio on the hardware thread

        //state
        this.currentStep = 0; //all 16th notes (0 -15)
        this.nextNoteTime = 0.0; // A variable where we calculate: "When should the next kick drum happen?"
        this.isPlaying = false; // start step sequencer in a paused state
        this.timerID = null; //init a reference to the scheduler while loop
    }

    start() {
        if (this.isPlaying) return

        // Start the "next note" immediately (or slightly in future to avoid clicks)
        //base it off the current audio context

        this.nextNoteTime = this.audioContext.currentTime + 0.05;
        this.currentStep = 0;
        this.isPlaying = true;

        this.scheduler(); //now schedule can start waking up every 25ms to validate the nect note so it can schedule back to the audio thread
    }

    stop() { 
            this.isPlaying = false;
            clearTimeout(this.timerID);
    }

    scheduler() {
        //next note time is 0 + 0.05 = 0.05s
        //current time is 0.00
        //scheduleaheadtime = 0.1 == 0.1
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime ) {
            this.scheduleNote(this.currentStep, this.nextNoteTime)
            this.advanceNote()
        }

        //keep the loop going if there's nothing to schedule up next 
        if (this.isPlaying) {
            this.timerID = setTimeout( () => {
                this.scheduler()
            }, this.lookahead)
        }
    }

    //advance the pointer to calculate when the next note should happen based on the global BPM
    advanceNote() {
        const bpm = this.getTempo() || 120;
        const secondsPerBeat = 60.0 / bpm;

        // 0.25 is for 16th notes (4 notes per beat)
        this.nextNoteTime += 0.25 * secondsPerBeat;

        //advance the step counter
        this.currentStep = (this.currentStep + 1) % 16;


    }
    // DISPATCH EVENT
  // Tells the Engine/UI: "Do something at this specific time"
    scheduleNote(stepNumber, noteTime) {
        this.onTick(stepNumber, noteTime)
    }
}