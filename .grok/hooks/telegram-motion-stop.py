#!/usr/bin/env python3
"""Grok CLI entry point for the Telegram motion gate.

The implementation lives in .claude/hooks/telegram-motion-stop.py and handles both
CLIs' input shapes (`reason`/`stopHookActive`/`lastAssistantMessage` from Grok,
`stop_hook_active`/`transcript_path`/`cwd` from Claude Code). One implementation on
purpose: the two copies had already drifted into different behaviour, and the copy
nobody was maintaining is the one that was running.
"""
from __future__ import annotations

import os
import runpy
import sys

root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
impl = os.path.join(root, ".claude", "hooks", "telegram-motion-stop.py")
if not os.path.exists(impl):
    sys.exit(0)
runpy.run_path(impl, run_name="__main__")
