const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const ERROR_CODE = 1;
const SUCCESS_CODE = 0;

function removeFromArray(array, obj) {
  return array.filter(element => element !== obj);
}

/**
 * A pool of worker threads.
 */
class WorkerPool {
  /**
   * Create a pool of worker threads.
   * @param {String} workerJobsPath The path to the module that exports the worker jobs
   *   as an object where the keys are strings (the job names) and the values are
   *   functions that take 0 or 1 argument (the job argument).
   * @param {Object} [options] Configuration options.
   * @param {Number} [options.numWorkers=os.cpus().length] The number of worker threads to spawn.
   * @param {Function} [options.debugLog] A function to print debug logs to.
   *   Consider using console.warn. If omitted, debug messages will not be logged.
   *   By default, uses the number of CPU cores.
   */
  constructor(workerJobsPath, options={}) {
    this.workerJobsPath = workerJobsPath;
    this.numWorkers = options.numWorkers || os.cpus().length;
    this.debugLog = options.debugLog || (() => {});

    this.idleQueue = [];
    this.allWorkers = [];
    this.dispatchQueue = [];
    this.shuttingDown = false;

    for (let i = 0; i < this.numWorkers; i += 1) {
      this.addNewWorker();
    }
  }

  addNewWorker() {
    const worker = new Worker(__filename, { workerData: this.workerJobsPath });
    this.allWorkers.push(worker);

    worker.once('online', () => {
      this.idleQueue.push(worker);
      this.dispatchNext();
    });

    worker.once('exit', (code) => {
      removeFromArray(this.idleQueue, worker);
      removeFromArray(this.allWorkers, worker);

      if (!this.shuttingDown) {
        this.debugLog(`Worker exited unexpectedly with code ${code}.`);
        this.addNewWorker();
      }
    });
  }

  dispatchNext() {
    const worker = this.idleQueue.shift();
    if (!worker) {
      return;
    }

    const nextJob = this.dispatchQueue.shift();
    if (!nextJob) {
      return;
    }

    worker.once('message', (message) => {
      this.returnWorkerToIdle(worker);

      if (message.code === ERROR_CODE) {
        return nextJob.reject(new Error(message.error));
      }

      nextJob.fulfill(message.result);
    });

    worker.once('exit', (code) => {
      nextJob.reject(new Error(`Worker exited with code: ${code}`));
    });

    worker.postMessage({ jobName: nextJob.jobName, jobArgument: nextJob.jobArgument });
  }

  returnWorkerToIdle(worker) {
    this.idleQueue.push(worker);
    this.dispatchNext();
  }

  /**
   * 
   * @param {String} jobName The name of the job for the worker thread to perform.
   * @param {*} jobArgument The argument to the job. Should be JSON serializable or
   *   it may fail to be communicated to the worker thread.
   */
  doWork(jobName, jobArgument) {
    if (this.shuttingDown) {
      throw new Error('The thread pool is shut down.');
    }
    return new Promise((fulfill, reject) => {
      this.dispatchQueue.push({ jobName, jobArgument, fulfill, reject });
      this.dispatchNext();
    });
  }

  /**
   * Shut down the thread pool and terminate all worker threads.
   */
  shutdown() {
    this.shuttingDown = true;
    return Promise.all(this.allWorkers.map(worker => worker.terminate()));
  }
}

// NYC can't see this code because it runs in the worker thread.
// Need to look at it and manually make sure all lines are covered (they are).
/* istanbul ignore if */
if (!isMainThread) {
  // Covered by most/all tests

  const jobs = require(workerData);

  parentPort.on('message', async (jobData) => {
    // Covered by most tests.

    const { jobName, jobArgument } = jobData;

    if (!jobs[jobName]) {
      // Covered by 'Rejects when job does not exist'
      return parentPort.postMessage({ code: ERROR_CODE, error: `Unable to find job '${jobName}' in job module at ${workerData}` });
    }

    if (typeof jobs[jobName] !== 'function') {
      // Convered by 'Rejects when job is not a function'
      return parentPort.postMessage({ code: ERROR_CODE, error: `'${jobName}' is not a function.` });
    }

    try {
      // Covered by most 'Successful jobs'
      const jobResult = await jobs[jobName](jobArgument);
      parentPort.postMessage({ code: SUCCESS_CODE, result: jobResult});
    } catch (err) {
      // Covered by most 'Error conditions'
      parentPort.postMessage({ code: ERROR_CODE, error: err.message });
    }
  });
}

module.exports = WorkerPool;
