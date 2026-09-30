# Independent review resolution — startup GPU follow-up

Two read-only Grok 4.6/high CLI reviews examined the diagnosis and source changes. No worker launched a game renderer. Raw reports accompany this resolution.

- **Accepted: saved neutral/race/fallback prefetch gap.** The early entry now calls the same starter-manifest loader main uses for these validated/fallback records. No unsaved default appearance-store import was added.
- **Accepted: build sharing and default graph checks.** Native generation verifies exactly one shared startup module owner, no Lite/storage in the early static graph, no appearance storage in the main static graph, and both compiled provenance hashes. The `ASHEN_LITE_BUNDLE=0` diagnostic build also passes these checks.
- **Not reproduced: optional-chain env access bypasses provenance guards.** Both actual compiled SHA comparison strings were already present. The build now asserts their presence, and native stale-manifest cases test rejection at runtime.
- **Accepted: missing compact piece validation.** Selected compact pieces are checked explicitly before starting requests; a malformed manifest cannot silently return an incomplete pack.
- **Accepted: missing migration/decompression cases.** Tests exercise the real v1/creator-v1 migrations, explicit developer query precedence, corrupt/blocked storage, request sharing, failed-manifest/asset retry, gzip decoded-size rejection/retry and missing compact pieces. Native held-Lite checks verify early requests and one shared manifest.
- **Evidence correction:** world-stage elapsed time includes awaited transport, decode and upload; it is not isolated CPU time. A multi-second queue callback hole suggests a GPU-service/backend first-use problem but does not establish Metal compilation, one shader or an asynchronous shader fix.

Reviewer limitations: the code reviewer did not run tests/build/live checks; parent verification supplies those. Remote Lite documentation may describe a newer version; installed Lite 1.31.1 remains authoritative. Default public timing differences cannot all be assigned to source changes across differently cached immutable hosts.
