#!/bin/bash
# Independent Grok visual review of the live Orc captures.
#
#   scripts/ashen-reach/judge-orc.sh pass0
#
# A fresh session every pass on purpose: a judge that carries the previous round's
# context anchors on its own earlier verdict instead of re-reading the frames.
# Per .agents/skills/grok-delegation: --model grok-4.6 --reasoning-effort high,
# --no-subagents required, and the judge may read images and write its verdict only.
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PASS="${1:?usage: judge-orc.sh <pass-label>}"
CAPTURES="$ROOT/ve-capture/ashen-reach/orc-review/$PASS"
OUT="$ROOT/.cache/orc-judge/$PASS"
mkdir -p "$OUT"
VERDICT="$OUT/verdict.md"
PROMPT="$OUT/prompt.md"

sed -e "s#CAPTURE_DIR#$CAPTURES#g" -e "s#VERDICT_PATH#$VERDICT#g" -e "s#PASS_LABEL#$PASS#g" \
    "$ROOT/.cache/orc-judge/judge-prompt.md" > "$PROMPT"

rm -f "$VERDICT"
"$HOME/.grok/bin/grok" \
    --prompt-file "$PROMPT" \
    --model grok-4.6 \
    --verbatim \
    --no-plan \
    --no-subagents \
    --permission-mode bypassPermissions \
    --max-turns 24 \
    --output-format json \
    --reasoning-effort high \
    > "$OUT/run.json" 2> "$OUT/run.err" || echo "grok exit $?"

python3 -c "
import json,sys
d=json.load(open('$OUT/run.json'))
print('stopReason', d.get('stopReason'), '| turns', d.get('num_turns'), '| session', d.get('sessionId'))
" 2>/dev/null || tail -5 "$OUT/run.err"
echo "--- verdict ---"
cat "$VERDICT" 2>/dev/null || echo "NO VERDICT WRITTEN; see $OUT/run.json"
