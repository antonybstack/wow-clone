# Runtime integration and correction handoffs

Read for character/scene integration, live harness work, or repeated Grok correction loops. These practices come from the September16 Moonwell work; adapt task size to the actual change.

## Deliver an observable slice early

For a refactor that changes rendering or animation, prefer visible boot plus one real operation before a broad test matrix. An armor task should first show the character, remove/re-equip one garment, and preserve movement/staff. Then expand to other races, cancellation, recovery and UI. Pure algorithm tests remain useful but do not establish a working render integration.

Give the worker exact files, stable API, known invariants, a runnable command, and the first evidence required. A long prompt is not a substitute for a small task. When a worker spends its budget reading without producing an executable experiment, narrow the next handoff to one discriminating test. Do not keep raising a broad task's cap.

## Make the harness trustworthy

- Use the exact game's Vite/Lite module URL, including query, and assert function identity before scene mutation. See [the browser guide](../../../../lite-moonwell/docs/debug-view.md). Do not mix raw package modules with optimized game modules.
- Check the actual exported namespace, not only declarations/internal source.
- A GLB named node may be a transform with multiple primitive meshes. Inspect connected material-bearing descendants or public `getContainerMeshes`; do not require the parent to have a material or assume flat `container.entities` is the complete mesh list. Lite visibility is `visible`.
- Begin with bounded boot/one-transition/screenshot stages. Reuse established lifecycle helpers. Expand a small working harness rather than generating a large new one before the first run.
- Separate `structuralChecksPassed`, `visualReviewPending`, and explicit visual acceptance. Capture absence of errors, identity preservation, and animation advancement; inspect the image independently. A black screenshot overrides a green counter-based report.
- Record whether a requested swap actually committed during the tested cast/jump. Completing after the action ends does not demonstrate phase continuity.

## Review data and spatial contracts

Full file hashes can be provenance rather than compatibility gates. For garment fits, preserve bind and geometry-signature validation while allowing animation-only byte changes.

Check arithmetic before accepting a spatial recipe: tread count × minimum depth must fit the available extent; risers must account for total elevation; architecture support samples must remain valid. Treat proposed shader thresholds and aesthetic improvements as experiments until viewed.

## Correction record

Write the observed failure, exact file/function, known evidence, next experiment, and files the worker may edit. Mark hypotheses as hypotheses. After a test disproves one, supersede it in docs; do not promote it to a permanent rule.

Keep source fixes and harness authoring in separate ownership when parallel. Run GPU verification after the relevant source writer finishes. At a turn cap, inspect artifacts and run ready checks; the parent can write the result report. Do not count report completeness as implementation correctness.
