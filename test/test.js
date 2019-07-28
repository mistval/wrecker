const WorkerPool = require('./../index.js');
const path = require('path');
const { assert } = require('chai');
const os = require('os');
const { wait } = require('./test_util.js');

const TEST_JOB_PATH = path.join(__dirname, 'test_jobs.js');
const NUM_CPUS = os.cpus().length;

describe('Initialization', function() {
  it(`Uses the number of CPUs (${NUM_CPUS}) in the system by default`, async function() {
    const pool = new WorkerPool(TEST_JOB_PATH);
    assert.equal(pool.numWorkers, NUM_CPUS);
    await pool.shutdown();
  });
  it('Allows number of workers to be specified', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH, { numWorkers: 9 });
    assert.equal(pool.numWorkers, 9);
    await pool.shutdown();
  });
});

describe('Successful jobs', function() {
  it('Completes a job', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH);
    const result = await pool.doWork('echo', 'Hello!');
    assert.equal(result, 'Hello!');
    await pool.shutdown();
  });
  it('Completes lots of simultaneous jobs', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH);
    const promises = [];
    for (let i = 0; i < 1000; ++i) {
      promises.push(pool.doWork('echo', 'Hello!'));
    }

    const results = await Promise.all(promises);
    results.forEach(result => assert.equal(result, 'Hello!'));
    await pool.shutdown();
  });
  it('Completes a long-running, async job', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH);
    const sum = await pool.doWork('longRunningAddition', { a: 5, b: 9 });
    assert.equal(sum, 14);
    await pool.shutdown();
  });
  it('Completes a lot of long-running, async jobs', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH, { numWorkers: 10 });
    const promises = [];
    const expectedResults = [];
    for (let i = 0; i < 20; ++i) {
      const a = Math.floor(Math.random() * 20);
      const b = Math.floor(Math.random() * 20);
      expectedResults.push(a + b);
      promises.push(pool.doWork('longRunningAddition', { a, b }));
    }

    const results = await Promise.all(promises);
    results.forEach((result, i) => assert.equal(result, expectedResults[i]));
    await pool.shutdown();
  });
  it('Can queue work after a delay after finishing work', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH, { numWorkers: 4 });
    for (let i = 0; i < 10; ++i) {
      await pool.doWork('echo', 'test');
    }

    await wait(300);
    await pool.doWork('echo', 'test');
    await pool.shutdown();
  });
});

describe('Error conditions', function() {
  it('Rejects when worker errors', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH);
    try {
      await pool.doWork('throwError');
      assert.fail();
    } catch (err) {
      assert.equal(err.message, 'errormsg');
    }

    await pool.shutdown();
  });
  it('Rejects when worker exits', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH);
    try {
      await pool.doWork('exit');
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.startsWith('Worker exited with code:'));
    }

    await pool.shutdown();
  });
  it('Creates new workers when workers exit', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH);

    for (let i = 0; i < NUM_CPUS + 5; i += 1) {
      try {
        await pool.doWork('exit');
      } catch (err) {
        assert.isTrue(err.message.startsWith('Worker exited with code:'));
      }
    }

    const result = await pool.doWork('echo', 'Hello');
    assert.equal(result, 'Hello');
    await pool.shutdown();
  });
  it('Rejects when job does not exist', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH);
    try {
      await pool.doWork('someInvalidJobName');
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.startsWith('Unable to find job '));
    }

    await pool.shutdown();
  });
  it('Rejects when job is not a function', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH);
    try {
      await pool.doWork('notAFunction');
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.endsWith('is not a function.'));
    }

    await pool.shutdown();
  });
  it('Debug logs when a process exits', function(done) {
    const pool = new WorkerPool(
      TEST_JOB_PATH,
      {
        debugLog: async (msg) => {
          await pool.shutdown();
          try {
            assert.isTrue(msg.startsWith('Worker exited'));
            done();
          } catch (err) {
            done(err);
          }
        },
      },
    );

    pool.doWork('exit').catch(() => {});
  });
});

describe('Shutdown', function() {
  it('Refuses to do more work after being told to shutdown (wait for shutdown)', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH);
    await pool.shutdown();

    try {
      await pool.doWork('echo', 'hi');
    } catch (err) {
      assert.equal(err.message, 'The thread pool is shut down.');
    }
  });
  it('Refuses to do more work after being told to shutdown (do not wait for shutdown)', async function() {
    const pool = new WorkerPool(TEST_JOB_PATH);
    const shutdownPromise = pool.shutdown();

    try {
      await pool.doWork('echo', 'hi');
    } catch (err) {
      assert.equal(err.message, 'The thread pool is shut down.');
    }

    await shutdownPromise;
  });
});
