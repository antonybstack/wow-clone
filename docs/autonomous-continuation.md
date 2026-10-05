# Autonomous continuation

The user explicitly authorized automatic continuation on 2026-10-04. This Codex
session created a native goal for the remaining implementable character
customization and armor-swapping work. At the 2026-10-05 runtime check its status
is **`blocked`**, not active; that status cannot be resumed by a repository file.
The latest user instruction authorizes meaningful work to continue. The
[focused 12-hour plan](plans/character-mmo/next-12-hours-2026-10-05.md) owns immediate
order and [the active queue](plans/character-mmo/next-ten.md) retains broader scope.
Do not claim automatic continuation is currently guaranteed.

Continue through implementation, verification, live review, delivery, commit/push
and release gates without requesting another “proceed.” Finish a bounded package
before choosing the next. Record actual results and the next actionable item in
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
