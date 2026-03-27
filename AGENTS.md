# ShadowCode — Agent Instructions

## Quick Start

Before asking the AI where files are or what the project does, **read the project constitution** first:

```
.shadowcode/AGENT_CONSTITUTION.md
```

This file is automatically loaded by Shadow AI at the start of every session and contains:
- Full project architecture overview
- Key file paths and their responsibilities
- All `shadowAI.*` settings and their defaults
- Security policies and compliance requirements
- The agent action format (`<EDIT>`, `<CREATE>`, `<DELETE>`, `<RUN>`)

## Important Paths

| Path | Purpose |
|------|---------|
| `.shadowcode/AGENT_CONSTITUTION.md` | Persistent AI session context |
| `src/vs/workbench/contrib/shadowAI/` | All Shadow AI source code |
| `src/vs/platform/telemetry/common/1dsAppender.ts` | Telemetry endpoint (redirected) |
| `build/lib/preLaunch.ts` | Launch pre-check script (tsx-compatible) |
| `scripts/code.sh` | Development launcher (`--no-sandbox` enabled) |
| `PHASE0_AUDIT.md` | Phase 0 cleanup and compliance checklist |
| `TODO.md` | Full project roadmap |

## When Adding Code

1. **Check the constitution first** — it has the architecture and all key locations.
2. **Follow the action format** — all file changes MUST use `<EDIT>` or `<CREATE>` XML tags.
3. **Never use `../` paths** — the security layer will block them.
4. **Run the domain guard** after adding any URLs: `npm run check-forbidden-domains`.
5. **Update `.shadowcode/AGENT_CONSTITUTION.md`** if you add major new features or change key paths.

## Updating the Constitution

If you make a major architectural change (new provider, new command, key file moved), update `.shadowcode/AGENT_CONSTITUTION.md` so future agents benefit immediately without re-reading the whole repo.
