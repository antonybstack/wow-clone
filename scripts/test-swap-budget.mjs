import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { SWAP_BUDGET, oversizedPieces, largestPiece } from './lib/swap-budget.mjs';

const PACKS = {
    human: 'public/ashen-reach/equipment/manifest-coverage-v1.json',
    orc: 'public/ashen-reach/equipment-orc/manifest-coverage-v1.json',
    undead: 'public/ashen-reach/equipment-undead/manifest-coverage-v1.json',
    humanShape: 'public/ashen-reach/human-shape-v1/manifest.json',
};
const manifests = Object.fromEntries(await Promise.all(Object.entries(PACKS)
    .map(async ([pack, path]) => [pack, JSON.parse(await fs.readFile(path, 'utf8'))])));

test('every published piece is within the swap byte ceiling', () => {
    // The ceiling exists so a future piece fails here rather than being discovered as a slow
    // first equip in play. Raising it is a decision, not a fix: cold latency tracks asset size.
    const over = oversizedPieces(manifests);
    assert.deepEqual(over, [], `pieces over ${SWAP_BUDGET.pieceBytes} bytes: ${JSON.stringify(over)}`);
});

test('the ceiling still has headroom over the largest published piece', () => {
    // A ceiling the content has already grown into is not a budget. If this fails, the content
    // moved and the budget needs re-measuring rather than relaxing.
    const largest = largestPiece(manifests);
    assert.ok(largest.bytes > 0, 'no published piece was read, so this test proves nothing');
    assert.ok(largest.bytes <= SWAP_BUDGET.pieceBytes * 0.9,
        `${largest.pack}/${largest.id} is ${largest.bytes} bytes, within 10% of the ${SWAP_BUDGET.pieceBytes} ceiling`);
});

test('the byte ceiling is consistent with the latency ceiling it is derived from', () => {
    // A piece at the ceiling must transfer, arrive and build inside coldLatencyMs on the profile
    // the budget names. Asserting the relationship stops the two drifting apart.
    const transferMs = SWAP_BUDGET.pieceBytes / (50 * 1024 * 1024 / 8) * 1000;
    assert.ok(transferMs + 40 + 20 <= SWAP_BUDGET.coldLatencyMs + 0.5,
        `a ${SWAP_BUDGET.pieceBytes}-byte piece needs ${(transferMs + 60).toFixed(0)} ms, over the ${SWAP_BUDGET.coldLatencyMs} ms ceiling`);
});

test('the budget separates latency from frame cost', () => {
    // Conflating them is the mistake the measurement exists to prevent: a 122 ms fetch is fine,
    // a 122 ms frame is not.
    assert.ok(SWAP_BUDGET.coldLatencyMs > SWAP_BUDGET.worstFrameMs * 2);
    assert.equal(SWAP_BUDGET.worstFrameMs, 33.33);
    // A warm swap may legitimately exceed one frame: it is wall-clock work across frames, not
    // a stall. The frame ceiling is what bounds the part a player feels.
    assert.ok(SWAP_BUDGET.warmSwapMs > SWAP_BUDGET.worstFrameMs);
    assert.ok(SWAP_BUDGET.warmSwapMs < SWAP_BUDGET.coldLatencyMs);
});
