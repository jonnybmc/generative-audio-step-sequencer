# simple-sequencer
a project showcasing a simple program to build your own rhythmic drum and synth patterns

# how to build quality software

## System Design

*Phase 1 components*
Build the metronome
    - Goal: keep track of time
    - What to build: some scrip that can log 'ticks' to the console every nth note, depending on some global state paramters
    - core for the entire sequencer to remain in sync

* Phase 2 the sound engine *
Build the key audio engine so for e.g. every tick of the metronome now triggers an actual beep from some basic OSC.
    - What to build: some basic loop that now triggers. abeep instead of some basic invisible mtronoem

* Phase 3 - the UI/interactivity *
- goal: getting some control over the sounds we are generating via the audio engine
- deliverable: having some global state class where interactivity has the net effect of updating the audio engine.


Phase 4
getting the polish in place

Phase 5
backend integration (using AI to autogenerate patterns)\

