# Native failure capture — preview 514fe898

Authoritative: `capture-wrapper.exit`, `summary.json`. One run of `run-capture.mjs`. Wrapper **exit 0** means the investigation completed, not that the rejected preview qualifies. Diagnostic only; no 1000ms budget, no FPS, no Telegram.

## Native exits

Controller **80387**. Twenty child CLI visits, all **exit 0**, `failed: false`. `capturedFailure: false`. `completed: true`. Frozen dist/source audit matched after the campaign.

probeHead `3ea495969c2d4c95f4e8737729dd0bbc4e139a46`. Preview `514fe898` / source `4ad2637`. Historical dist seal `fc5bec8da2efc78ef1b60620a271ad27b4e46c46b00a05c2a380381550aabbfb` is not a seal for current product-input fingerprint `648aa45bb6aaf34b3f84f3e4d0362180cefe564ba463465eb56c129424f8ede0`.

Each visit: ownership `active: false`, `renderingClients: 0`. networkDiagnostics transport/issues/orphans **0**. NetLog events ~56k–57k and JSON-parsed by the operator.

## Cause

**Unproved.** All 20 max-uncovered visits were clean. This does not explain or clear rejected preview run 1 `Failed to fetch` of `texture-6dc86c298450.webp`, and does not clear the older 14/60 fetch failures.

## Cleanup

Controller 80387 and all 20 Chrome PIDs (80448 … 81915) plus GPU helpers **GONE**. 10037/7074/5173 free. No leftover probe. User Edge 2931 / Orca 98938 / Shadowglass untouched.
