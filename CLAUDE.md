# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**vlab** is a virtual lab platform for education and training, built around VMware vCenter.

### Architecture

- **`backend/`** — Node.js + Express + TypeScript REST API, runs on port 8800.
  - Connects to a PostgreSQL database for user/group/lab/assignment records.
  - Talks to vCenter via its REST API to manage VMs (clone, power, delete, console ticket).
  - Talks to Cisco ASA via SSH to manage VPN accounts.
  - Includes a built-in HTTPS WebSocket proxy (`services/proxy/`) on a separate port (default 8843), forwarding browser WSS connections to ESXi console endpoints — necessary because Next.js does not support raw WebSocket.
  - Streams long-running operations (clone, delete, batch create) to the frontend via NDJSON.

- **`frontend/`** — Next.js + Tailwind + shadcn/ui, runs on port 3000.
  - Proxies `/api/*` to the backend via `next.config.ts` rewrites.
  - Auth: JWT access token (cookie) + refresh token, auto-refreshed in `lib/api.ts`.
  - Two route groups: `(dashboard)` (sidebar layout, requires auth) and `console` (fullscreen, requires auth via its own layout).
  - Admin pages under `(dashboard)/admin/`: users, groups, labs, categories, assignments, VMs (by group/by user), vCenter browser, cron tasks.
  - Student-facing pages: `(dashboard)/vms` (my VMs), `(dashboard)/labs` (available labs).
  - `console/[id]` — fullscreen WMKS VM console page, loads VMware WMKS library dynamically.
  - Streaming responses consumed via `streamRequest` in `lib/api.ts`, displayed as stacked toasts (loading per step, dismissed on completion, then success/error).

### Key conventions

- Streaming: backend emits `{ message, done, error }` NDJSON lines; frontend collects toast IDs and dismisses all on `done`.
- Power badge (`components/vm-power-badge.tsx`): polls VM power state, shows colored badge + icon buttons (Play/Stop/Restart/Console).
- All UI text in English; Chinese comments allowed in code.

## Language & Response Style

- **Always reply in Chinese**, regardless of the language the user writes in. Keep code, filenames, and variable names in English as-is.
- Be concise and direct. Do not restate what the user just said.
- Do not summarize "what you just did" at the end of a response — the user can see the diff.
- No emojis unless the user explicitly asks.

## Collaboration Rules

### 1. Plan First

- Enter plan mode for any non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, stop and re-plan immediately — do not keep pushing
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents to keep the main context window clean
- Offload research, exploration, and parallel analysis to subagents
- One focused task per subagent

### 3. Self-Improvement Loop

- After any correction from the user: update `tasks/lessons.md` with the pattern
- Write rules that prevent the same mistake from recurring
- Review lessons at the start of each session

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Ask: "Would a staff engineer approve this?"

### 5. Demand Elegance

- For non-trivial changes: pause and ask "is there a more elegant way?"
- Skip this for simple, obvious fixes — do not over-engineer

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Do not ask for hand-holding.
- Point at logs, errors, or failing tests — then resolve them.

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Capture Lessons**: Update `tasks/lessons.md` after any correction

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Touch minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
