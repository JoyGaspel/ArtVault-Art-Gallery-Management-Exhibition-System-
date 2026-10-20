const { Worker } = require('node:worker_threads');
const path = require('node:path');

let worker;
let nextId = 0;
const pending = new Map();
function reset(target) {
  if (worker !== target) return;
  worker = null;
  for (const { reject, timer } of pending.values()) {
    clearTimeout(timer);
    reject(new Error('Local content classifier unavailable'));
  }
  pending.clear();
  target.terminate().catch(() => {});
}

function classify(pixels) {
  if (pending.size >= 4) return Promise.reject(new Error('Local content classifier busy'));
  if (!worker) {
    const target = new Worker(path.join(__dirname, 'localContentWorker.js'));
    worker = target;
    target.on('error', () => reset(target));
    target.on('exit', () => reset(target));
    target.on('message', ({ id, predictions, error }) => {
      if (worker !== target) return;
      const task = pending.get(id);
      if (!task) return;
      pending.delete(id);
      clearTimeout(task.timer);
      if (error) task.reject(new Error('Local content classifier unavailable'));
      else task.resolve(predictions);
      if (!pending.size) target.unref();
    });
  }
  const target = worker;
  target.ref();
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => reset(target), 60000);
    pending.set(id, { resolve, reject, timer });
    target.postMessage({ id, pixels });
  });
}

module.exports = { classify, close: () => { if (worker) reset(worker); } };
