/**
 * Worker message type constants
 * Used for communication between main thread and grooveWorker
 */

export const WORKER_MESSAGES = {
  // Main thread -> Worker
  HUMANIZE: 'HUMANIZE',

  // Worker -> Main thread
  READY: 'READY',
  HUMANIZED_RESULT: 'HUMANIZED_RESULT'
};
