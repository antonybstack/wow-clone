# Autonomous continuation

The user explicitly renewed autonomous completion of the active milestone queue on
2026-10-06. The existing native goal already covers all remaining implementable
character customization and armor-swapping work in CURRENT and next-ten, with
verification, delivery, commit/push and production gates. The user resumed it on 2026-10-06; a fresh `get_goal` check now reports
**`active`**. The earlier `blocked` / “Goal stalled” state is resolved.

The available goal tools can create, inspect, complete, pause or mark blocked;
they cannot resume an existing unfinished goal. Creating another goal cannot
replace it, and the unfinished goal must not be falsely marked complete.
The supported user action was **Resume in the goal progress row**. A Computer Use
attempt to access the Codex app was denied for safety reasons. Do not bypass that
denial through terminal injection, internal state edits or an undocumented API.
An ordinary “continue” message has permitted work but has not changed the observed
scheduler status. Verify `get_goal` reports `active` before claiming automatic
continuation is enabled. This is a scheduler limitation, not a project access block.

The [focused 12-hour plan](plans/character-mmo/next-12-hours-2026-10-05.md) and
[active queue](plans/character-mmo/next-ten.md) retain the intended scope. Resume
from CURRENT, currently M6 multi-piece continuous-motion clearance, then take
remaining actionable M8/M9/M10 exits. Do not redo accepted M1–M5/M7 work or reopen
parked multiplayer hosting merely because the native goal mentions its old M5
starting point. Newly encountered valid regressions remain in scope.

Continue through implementation, verification, live review, delivery, commit/push
and release gates without requesting another “proceed.” Finish a bounded package
before choosing the next. A successful commit, delivery or milestone checkpoint
is not a reason to wait for another user message: continue directly to the next
available task. If one gate requires external action, record it and advance other
authorized tasks. Record actual results and the next actionable item in
CURRENT so a fresh session can resume. Historical plans and parked multiplayer
work are outside this authorization.

Codex's [native Goal mode](https://learn.chatgpt.com/docs/long-running-work)
provides continuation across turns in the current running session. It is preferable
to stacking a second continuation mechanism on top of it. An explicit user stop
or pause takes precedence. An exhausted budget, unavailable runtime, disconnected
client or sleeping machine cannot be repaired by a repository hook. Never claim
that work will continue after the runtime has ended.

There is already a Claude remaining-work reminder at
[remaining-work-stop.py](../.claude/hooks/remaining-work-stop.py), registered in
[settings.json](../.claude/settings.json). It blocks one ordinary stop when the
active queue contains work, then yields if `stop_hook_active` is set. That is a
reminder, **not an indefinite automatic-continuation guarantee**. It is separate
from the motion-delivery reminders, which still apply.

Codex also supports [Stop hooks](https://learn.chatgpt.com/docs/hooks): a JSON
`decision: "block"` with a reason requests another turn. Project hook definitions
must be reviewed and trusted through `/hooks`; creating a file alone does not
activate it. This session does not install a duplicate Codex Stop hook or modify
the user's global Orca hooks. On a future CLI session, use `/goal` with this scope
if native continuation is not already active.

True external dependencies stay explicit. Physical-phone acceptance is distinct
from desktop emulation. Do not mark a milestone delivered while its required gate
is missing; advance other authorized work when possible. Preserve the browser
ownership procedure and stop owned renderers before ending a live check.
