# wrecker

An easy to use worker thread pool implementation.

## Usage

First define a module that contains the jobs you want to run in worker threads. Export an object whose keys are job names and whose values are functions that take zero or one arguments (the job argument). The functions can be async. For example:

jobs.js
```js
module.exports = {
  five: function() {
    return 5;
  },
  nine: function() {
    return 9;
  },
  add: function(args) {
    return args.a + args.b;
  },
};
```

Now you can create a WorkerPool and use it to run these jobs in worker threads. For example, this prints 14:

```js
const WorkerPool = require('wrecker');
const path = require('path');

const JOBS_MODULE_PATH = path.join(__dirname, 'jobs.js');

const pool = new WorkerPool(JOBS_MODULE_PATH);

async function start() {
  const a = await pool.doWork('five');
  const b = await pool.doWork('nine');
  const sum = await pool.doWork('add', { a, b });

  // Shut down the pool and terminate all worker threads.
  await pool.shutdown();

  return sum;
}

start().then(sum => console.log(sum));
```

## API

### const pool = new WorkerPool(jobsModulePath, options)

The WorkerPool constructor takes two arguments. The first is required, it's the path to your jobs module (where jobs are exported as shown above). The second is an optional options argument. Here is an example with all options specified:

```js
const path = require('path');
const WorkerPool = require('wrecker');

const JOBS_MODULE_PATH = path.join(__dirname, 'jobs.js');
const options = {
  numWorkers: 5, // The number of worker threads to spawn. By default, this is the number of CPU cores in the system.
  debugLog: console.warn, // A function to log debug messages to (such as when your worker threads unexpectedly exit). By default, debug messages are not logged.
};

const pool = new WorkerPool(JOBS_MODULE_PATH, options);
```

### pool.doWork(jobName, jobArgument)

Do work in a worker thread. The first argument is the string name of the job (which should be defined as a function in your jobs module) and the second is the argument that will be passed to that job. The jobArgument should be JSON serializable. doWork returns a promise that returns the result of the job. See the example under **Usage** above.

The work will be executed on the next available worker thread. If no worker thread is currently available, the job will be queued until a thread is available.

### pool.shutdown()

Terminate all threads in the pool. After calling this, you will not be able to do any more work with this pool (doWork will throw an error). Any work in progress may be ended abruptly, mid-processing. shutdown() returns a promise that resolves when all threads are terminated.
