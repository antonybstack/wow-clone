import { composeStarterOutfit } from './compose-starter-outfit.js';

self.onmessage = ({ data: { source, options } }) => {
    try {
        if (!source) throw new Error('starter outfit worker has no source body');
        const result = composeStarterOutfit(source, options);
        self.postMessage({ result }, [result.buffer]);
    } catch (error) {
        self.postMessage({ error: error.message || String(error) });
    }
};
