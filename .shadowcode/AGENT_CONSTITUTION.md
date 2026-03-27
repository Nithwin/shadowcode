# ShadowCode Project Constitution

This file is loaded at the start of every Shadow AI session as a persistent system prompt.
It prevents the agent from needing to re-read the entire project on every query.

---

## What is ShadowCode?

**ShadowCode** is a fork of VS Code OSS (the Microsoft open-source editor) rebranded and hardened for:
- **Privacy-first**: All Microsoft telemetry endpoints have been removed or redirected to internal ShadowCode infrastructure.
- **Local-first AI**: Cloud providers are optional and fully blocked by `shadowAI.offlineLock`.
- **Open ecosystem**: Uses Open VSX for marketplace, not the proprietary Microsoft Marketplace.

---

## Codebase Architecture

| Area | Path | Notes |
|------|------|-------|
| Shadow AI agent | `src/vs/workbench/contrib/shadowAI/browser/shadowAI.contribution.ts` | Main chat agent, provider registry, all action commands |
| AI Providers | `src/vs/workbench/contrib/shadowAI/browser/` | Ollama, Groq, OpenRouter, HuggingFace, Custom |
| AI Settings | `src/vs/workbench/contrib/shadowAI/common/shadowAISettings.ts` | All `shadowAI.*` VS Code settings |
| AI Memory | `src/vs/workbench/contrib/shadowAI/common/shadowAIMemory.ts` | Workspace + chat scoped persistent memory |
| Model Caching | `src/vs/workbench/contrib/shadowAI/common/shadowAIModelCache.ts` | TTL-based cache for provider model lists |
| Model Routing | `src/vs/workbench/contrib/shadowAI/common/shadowAIModelPlan.ts` | Fallback/priority model plan builder |
| Task Router | `src/vs/workbench/contrib/shadowAI/common/shadowAITaskRouter.ts` | Infers task kind from prompt and builds multi-step plans |
| Telemetry | `src/vs/platform/telemetry/common/1dsAppender.ts` | Redirected to `telemetry.shadowcode.internal` |
| Build Scripts | `build/gulpfile.reh.ts`, `build/lib/extensions.ts` | CDN redirected to `cdn.shadowcode.internal` |
| Launch Script | `scripts/code.sh` | Main development launch script |

---

## Key Settings (shadowAI.*)

All settings live under `shadowAI.*` in user/workspace settings:

| Key | Default | Purpose |
|-----|---------|---------|
| `shadowAI.ollamaEndpoint` | `http://localhost:11434` | Local Ollama instance URL |
| `shadowAI.offlineLock` | `false` | Block all cloud providers for fully local operation |
| `shadowAI.enabledProviders` | `["ollama","openrouter","groq","huggingface","custom"]` | Explicit allow-list |
| `shadowAI.providerPriority` | `["ollama","openrouter","groq","huggingface","custom"]` | Fallback order |
| `shadowAI.defaultModel` | `"auto"` | Model used when no model explicitly selected |
| `shadowAI.autoModelFallback` | `true` | Retry next model on rate-limit/network failure |
| `shadowAI.maxModelFallbackAttempts` | `4` | Max automatic retries |
| `shadowAI.modelListCacheTtlMs` | `30000` | TTL for model list cache (ms) |
| `shadowAI.workflowProfile` | `"balanced"` | `offline`, `balanced`, or `cloud` |
| `shadowAI.autoApplyEdits` | `true` | Auto-save AI edits directly to disk (no confirm) |

Cloud keys (`groqApiKey`, `openRouterApiKey`, etc.) are migrated to VS Code secure secret storage on first use.

---

## Security Policies

- **No Microsoft telemetry domains** in runtime defaults (enforced by `scripts/check-forbidden-domains.sh`).
- **Path traversal protection** on all AI file writes — AI cannot write outside the workspace.
- **API key redaction** applied to all surfaced error messages via `shadowAIRedaction.ts`.
- Cloud providers are blocked when (`shadowAI.offlineLock = true`) or removed from `shadowAI.enabledProviders`.

---

## Shadow AI Agent Action Format

Shadow AI runs as an **Autonomous ReAct (Reason + Act) Agent** inside a loop.
You MUST use these tags to interact with the workspace:

```xml
<THOUGHT>
I need to check the exact spelling of the function in utils.ts before editing.
</THOUGHT>
<TOOL_CALL>
{"name": "read_file", "arguments": {"path": "src/utils.ts"}}
</TOOL_CALL>
```

**Available Tools:**
- `list_dir` (`path`): Explore directories to find files.
- `read_file` (`path`): Get exact file contents.
- `edit_file` (`path`, `search`, `replace`): Edit a chunk of code with precise search/replace.
- `create_file` (`path`, `content`): Create or overwrite a file with full content.
- `delete_file` (`path`): Delete a file from the workspace.
- `grep_search` (`query`, `includes`): Search for text patterns across all workspace files.
- `run_command` (`command`): Execute shell commands (npm test, ls, etc.)
- `update_memory` (`thought`, `taskStatus`): Save your chain-of-thought and task progress to persistent memory. Use this FIRST on complex tasks!

You can also use `<CREATE file="path">content</CREATE>` or `<EDIT file="path">content</EDIT>` XML tags.

**RULES**:
1. ALWAYS read a file before editing it — never guess at contents.
2. Use grep_search to find definitions before making changes.
3. Provide COMPLETE file contents when creating files — never truncate.
4. Use file paths relative to the workspace root. Never use `../` or absolute paths.
5. When finished, simply reply to the user without any tags to stop the loop.

---

## Development Workflow

```bash
# Install dependencies
npm install

# Start incremental watch builds
npm run watch-client-transpile
npm run watch-client

# Launch development editor
./scripts/code.sh

# Type-check source
npm run compile-check-ts-native

# Check for forbidden Microsoft domains
npm run check-forbidden-domains
```

---

## Phase 0 Status (Cleanup & Rebrand)

| Task | Status |
|------|--------|
| Microsoft telemetry endpoints removed | ✅ Done |
| CDN fallbacks replaced | ✅ Done |
| Forbidden domain guard script | ✅ Done |
| Path traversal security fix | ✅ Done |
| AI context hallucination fix | ✅ Done |
| Full CSP review | ⏳ TODO |
| Open VSX end-to-end verification | ⏳ TODO |

---

*This file is loaded automatically by Shadow AI. Keep it concise and update it when major features are added.*
