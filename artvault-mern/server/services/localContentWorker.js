const { parentPort } = require('node:worker_threads');
const tf = require('@tensorflow/tfjs');
const { load } = require('nsfwjs/core');
const { MobileNetV2Model } = require('nsfwjs/models/mobilenet_v2');

// This worker must remain offline: neither images nor model requests leave it.
globalThis.fetch = async () => { throw new Error('Remote calls are disabled in the local content worker'); };

tf.enableProdMode();
let model;
let queue = Promise.resolve();
parentPort.on('message', ({ id, pixels }) => {
  queue = queue.then(async () => {
    let tensor;
    try {
      if (!model) {
        await tf.setBackend('cpu');
        await tf.ready();
        // Model weights ship with the package; no remote model or API.
        model = await load('MobileNetV2', { modelDefinitions: [MobileNetV2Model] });
      }
      tensor = tf.tensor3d(new Uint8Array(pixels), [224, 224, 3], 'int32');
      parentPort.postMessage({ id, predictions: await model.classify(tensor, 5) });
    } catch {
      parentPort.postMessage({ id, error: true });
    } finally { tensor?.dispose(); }
  });
});
