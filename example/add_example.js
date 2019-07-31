const path = require('path');
const WorkerPool = require('../index.js');

const JOBS_MODULE_PATH = path.join(__dirname, 'add_jobs.js');

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
