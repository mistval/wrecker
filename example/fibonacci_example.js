const { calculateFibonacci } = require('./fibonacci_jobs.js');
const WorkerPool = require('./../index.js');
const path = require('path');





console.time('Single-threaded');

for (let i = 0; i < 8; i += 1) {
  console.log(`The 40th Fibonacchi number is ${calculateFibonacci(40)}`);
}

console.timeEnd('Single-threaded');
console.log('');





const pool = new WorkerPool(path.join(__dirname, 'fibonacci_jobs.js'), { numWorkers: 4 });

async function calculateAndPrint() {
  const result = await pool.doWork('calculateFibonacci', 40);
  console.log(`The 40th Fibonacchi number is ${result}`);
}

async function workers() {
  console.time('With 4 workers');

  const promises = [];
  for (let i = 0; i < 8; i += 1) {
    promises.push(calculateAndPrint());
  }

  await Promise.all(promises);
  await pool.shutdown();

  console.timeEnd('With 4 workers');
}

workers();
