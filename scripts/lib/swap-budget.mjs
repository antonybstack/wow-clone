/** What a piece change is allowed to cost, so a future piece fails a gate rather than being
 *  noticed later.
 *
 * The ceilings are derived from the measured distribution with headroom, not chosen in advance.
 * Measurements are in docs/plans/character-mmo/results/m6-swap-budget-2026-10-02.md: cold 86.1 ms
 * median and 122.6 worst at 50 Mbit/s and 40 ms, rebuilt 18.8 / 48.6, resident 0.5 / 4.8, worst
 * frame 14.1 median / 21.9 maximum.
 *
 * Latency and frame cost are separate on purpose. A 122 ms fetch is not a stall; a 122 ms frame
 * would be, and only the second is something a player sees.
 *
 * The byte ceiling is *derived* from the latency ceiling rather than stated beside it. Stating
 * them independently is how the first version of this file ended up with a 512 KiB limit that
 * sat below the published p95 of 520 KB, because it generalised from the pieces one measurement
 * happened to fetch and never saw the shape-family pack.
 */
const BYTES_PER_SECOND = 50 * 1024 * 1024 / 8;   // the shared cold-start profile's bandwidth
const LATENCY_MS = 40;                            // ...and its round trip
/** Build and commit work after the bytes arrive: ~17 ms across the measured cold rows. */
const BUILD_ALLOWANCE_MS = 20;

export const SWAP_BUDGET = Object.freeze({
    profile: '50 Mbit/s, 40 ms',
    /** Request latency for a piece fetched over the network. */
    coldLatencyMs: 200,
    /** Any single frame during a swap. This is the one a player feels. */
    worstFrameMs: 33.33,
    /** A swap whose bytes are already local, resident or rebuilt.
     *
     * These are deliberately one ceiling rather than two. The loader keeps only two idle
     * pieces, so a caller cannot tell whether a given change will hit the resident path or
     * rebuild: across 240 re-equips the median is 0.10 ms and the p95 4.10, but the p99 is
     * 21.10 and the maximum 26.90, and that tail is the rebuild path showing through. A
     * separate 10 ms "resident" ceiling, set from a 36-sample worst of 4.8, was breached on
     * its first live run by a 10.9 ms sample that was really a rebuild. This bounds both,
     * from the rebuilt distribution of 18.8 ms median and 48.6 worst. */
    warmSwapMs: 60,
    /** Published bytes for one piece, derived so a piece at the ceiling lands at coldLatencyMs. */
    pieceBytes: Math.floor((200 - LATENCY_MS - BUILD_ALLOWANCE_MS) / 1000 * BYTES_PER_SECOND),
    measuredAt: '2026-10-02',
});

/** Published pieces that exceed the byte ceiling, as rows. Pure: callers supply the manifests,
 *  so this runs offline in the test suite. */
export function oversizedPieces(manifests, ceiling = SWAP_BUDGET.pieceBytes) {
    const rows = [];
    for (const [pack, manifest] of Object.entries(manifests)) {
        for (const group of ['items', 'compactItems']) {
            for (const [id, entry] of Object.entries(manifest[group] ?? {})) {
                // The body is not a swappable piece; it is the character the pieces go on.
                if (id === 'body' || typeof entry?.bytes !== 'number') continue;
                if (entry.bytes > ceiling) rows.push({ pack: group === 'items' ? pack : `${pack} (compact)`, id, bytes: entry.bytes, over: entry.bytes - ceiling });
            }
        }
    }
    return rows.sort((a, b) => b.bytes - a.bytes);
}

/** The largest published piece, so a ceiling the content has grown into is visible. */
export function largestPiece(manifests) {
    let largest = { bytes: 0, id: null, pack: null };
    for (const [pack, manifest] of Object.entries(manifests)) {
        for (const group of ['items', 'compactItems']) {
            for (const [id, entry] of Object.entries(manifest[group] ?? {})) {
                if (id === 'body' || typeof entry?.bytes !== 'number') continue;
                if (entry.bytes > largest.bytes) largest = { bytes: entry.bytes, id, pack };
            }
        }
    }
    return largest;
}
