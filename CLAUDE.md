# CLAUDE.md

> **Read `AGENTS.md` first.** It is the authoritative, maintained development
> guide for this codebase (~30 sections: architecture of each core file, the
> contribution rubric, known pitfalls, testing philosophy, and the plugin /
> skill / toolset / cron / kanban systems). This file is only a pointer plus
> the few facts a session needs up front — when it disagrees with `AGENTS.md`,
> `AGENTS.md` wins.

## What this is

**Hermes Agent** (Nous Research) — one agent core running across a CLI, a
~20-platform messaging gateway, a TUI, and an Electron desktop app, with
memory, skills, subagent delegation, and scheduled jobs. Extended through
**plugins and skills**, not by growing the core.

## This is a fork — read this before any git work

This checkout is a **personal fork** that tracks Nous Research's upstream.
Full workflow with copy-paste commands is in **`DEV-GUIDE.md`** — read it
before syncing, branching, or committing.

- **`origin`** → `github.com/yanggul00/hermes-procengai` (the user's fork).
- **`upstream`** → `github.com/NousResearch/hermes-agent` (Nous, read-only — **never push here**).
- **`main`** is a **pristine mirror** of `upstream/main`. **Never commit to `main`.**
  It only ever fast-forwards to match upstream; it is the safety anchor.
- **`procengai`** is the personal trunk — the user's own version of Hermes.
  All personal work lands here; upstream changes are merged *into* it.
- **Feature branches** (`feat/...`, `fix/...`) fork off `procengai` and merge back into it.

When the task is personal development, branch off `procengai`, not `main`.
The `AGENTS.md` contribution rubric / PR conventions describe contributing
*back to Nous upstream*; they apply only when intentionally upstreaming a
change, not to everyday work on this fork.

## Two invariants that govern every change

- **Per-conversation prompt caching is sacred.** Don't mutate past context,
  swap toolsets, or rebuild the system prompt mid-conversation (the only
  exception is context compression). Doing so invalidates the cache and
  multiplies the user's cost.
- **The core is a narrow waist; capability lives at the edges.** Every core
  model tool is sent on every API call, so the bar for new *core* surface is
  high. New capability should arrive as a CLI command + skill, a service-gated
  tool, or a plugin.

See `AGENTS.md` → "What Hermes Is" and "Contribution Rubric" for the full intent layer.

## Testing

**Always use `scripts/run_tests.sh` — never call `pytest` directly.** The
wrapper enforces CI parity (unset credentials, `TZ=UTC`, `LANG=C.UTF-8`,
subprocess-per-test isolation). Direct pytest has caused repeated
works-locally / fails-in-CI incidents.

```bash
scripts/run_tests.sh                                   # full suite (run before pushing)
scripts/run_tests.sh tests/gateway/                    # one directory
scripts/run_tests.sh tests/agent/test_foo.py::test_x   # one test
scripts/run_tests.sh --no-isolate tests/foo/           # faster, for debugging
```

Don't write change-detector tests (assertions on model catalogs, config
version numbers, or enumeration counts). See `AGENTS.md` → "Testing".

## Environment & entry points

- Activate the venv first: `source .venv/bin/activate` (POSIX) /
  `.venv\Scripts\activate` (Windows). Falls back to `venv/` in some checkouts.
- Native Windows is supported (no WSL required) — use forward slashes or
  `.venv\Scripts\` paths accordingly.
- Console scripts (`pyproject.toml`): `hermes` (CLI), `hermes-agent` (core
  loop), `hermes-acp` (editor ACP server).
- User config/runtime lives under `~/.hermes/` (`config.yaml`, `.env`, `logs/`)
  and is profile-aware via `get_hermes_home()` — not in the repo.

## Load-bearing files (full tree in `AGENTS.md` → "Project Structure")

- `run_agent.py` — `AIAgent`, the core conversation loop (~12k LOC)
- `cli.py` — `HermesCLI` interactive orchestrator (~11k LOC)
- `model_tools.py` / `toolsets.py` — tool discovery, orchestration, core tool list
- `hermes_state.py` — `SessionDB`, the SQLite session store (FTS5 search)
- `gateway/platforms/` — one adapter per messaging platform
- `tools/environments/` — terminal backends (local, docker, ssh, modal, daytona, singularity)
- `plugins/`, `skills/`, `optional-skills/` — the primary extension surface
- `ui-tui/` (Ink/React) + `tui_gateway/` (Python JSON-RPC backend) — the TUI
