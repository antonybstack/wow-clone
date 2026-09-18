import { composeFixture } from './compose-fixture.js';
import { inspectBindContract } from './bind-contract.js';

let source;
self.onmessage = async ({ data: { id, source: initialSource, options } }) => {
  try {
    if (initialSource) {
      source = initialSource;
      self.postMessage({ id, result: null });
      return;
    }
    if (!source) throw new Error('Fixture worker has no source body');
    const composed = composeFixture(source, options);
    const bind = await inspectBindContract(composed.buffer);
    self.postMessage({ id, result: { ...composed, bind } }, [composed.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
