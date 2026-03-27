# ShadowCode

ShadowCode is a privacy-first, AI-native editor core based on the VS Code OSS codebase.

## Project Goals

- No Microsoft branding in product-facing surfaces.
- No Microsoft telemetry endpoints.
- Open ecosystem support with Open VSX.
- Offline-first AI workflows, including local providers.

## Build From Source

1. Install Node.js, npm, and platform build dependencies.
2. Run `npm install` in the repository root.
3. Start incremental builds:
   - `npm run watch-client-transpile`
   - `npm run watch-client`
   - `npm run watch-extensions`
4. Launch development app:
   - `./scripts/code.sh`

## Contributing

See `CONTRIBUTING.md`.

## Security

See `SECURITY.md` for private vulnerability reporting.

## Shadow AI Configuration

Shadow AI supports local-first model routing with optional cloud providers. Configure settings in user or workspace settings (`settings.json`) using the `shadowAI.*` keys below.

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `shadowAI.ollamaEndpoint` | `string` | `http://localhost:11434` | Base URL for the local Ollama instance. |
| `shadowAI.groqEndpoint` | `string` | `https://api.groq.com/openai/v1` | Groq OpenAI-compatible API endpoint. |
| `shadowAI.groqApiKey` | `string` | `""` | Groq API key. Migrated to secure secret storage on use. |
| `shadowAI.groqModels` | `string[]` | `[...]` | Model IDs exposed by the Groq provider picker. |
| `shadowAI.openRouterEndpoint` | `string` | `https://openrouter.ai/api/v1` | OpenRouter API endpoint. |
| `shadowAI.openRouterApiKey` | `string` | `""` | OpenRouter API key. Migrated to secure secret storage on use. |
| `shadowAI.openRouterModels` | `string[]` | `[...]` | Model IDs exposed by the OpenRouter provider picker. |
| `shadowAI.huggingFaceEndpoint` | `string` | `https://router.huggingface.co/v1` | Hugging Face router endpoint. |
| `shadowAI.huggingFaceApiKey` | `string` | `""` | Hugging Face API token. Migrated to secure secret storage on use. |
| `shadowAI.huggingFaceModels` | `string[]` | `[...]` | Model IDs exposed by the Hugging Face provider picker. |
| `shadowAI.customEndpoint` | `string` | `https://api.openai.com/v1` | Custom OpenAI-compatible API endpoint. |
| `shadowAI.customApiKey` | `string` | `""` | Custom provider API key. Migrated to secure secret storage on use. |
| `shadowAI.customModels` | `string[]` | `[]` | Model IDs exposed by the custom provider picker. |
| `shadowAI.enabledProviders` | `string[]` | `["ollama","openrouter","groq","huggingface","custom"]` | Explicit allow-list of enabled providers. |
| `shadowAI.offlineLock` | `boolean` | `false` | Forces local-only operation by blocking cloud providers. |
| `shadowAI.modelListCacheTtlMs` | `number` | `30000` | TTL for cached model lists (milliseconds). Set `0` to disable caching. |
| `shadowAI.providerPriority` | `string[]` | `["ollama","openrouter","groq","huggingface","custom"]` | Provider fallback order for automatic model selection. |
| `shadowAI.defaultModel` | `string` | `codellama` | Preferred model identifier for Shadow AI chat operations. |

### Notes

- Cloud provider API keys are migrated to secure secret storage the first time they are resolved.
- Errors surfaced in chat and diagnostics apply token/API key redaction before display.
- Disable cloud providers by either removing them from `shadowAI.enabledProviders` or turning on `shadowAI.offlineLock`.

## GenAI Innovation Modules (Experimental)

ShadowCode now includes foundational modules for specialized, lower-compute agent workflows:

- Task Router (`shadowAITaskRouter`): infers task type and generates multi-agent plans per request (presentation, document, spreadsheet, browser research, terminal fixes, code).
- Artifact Blueprint Engine (`shadowArtifactBlueprint`): generates structured artifact blueprints for PPT-style decks, docs, and spreadsheets without generating Python scripts first.
- Terminal Insight Engine (`shadowTerminalInsight`): classifies command failures and proposes deterministic next commands from output/error text.

New commands in chat toolbar and command palette:

- `Shadow AI: Generate Artifact Blueprint`
- `Shadow AI: Analyze Terminal Output`
- `Shadow AI Browser Agent: Open Page`
- `Shadow AI Browser Agent: Add Console Logs to Chat`
- `Shadow AI Browser Agent: Toggle Browser DevTools`
- `Shadow AI Memory: Add Project Note`
- `Shadow AI Memory: Add Chat Note`
- `Shadow AI Memory: Show Context Summary`
- `Shadow AI: List Provider Models`
- `Shadow AI: Open Agent Marketplace`

These modules are designed as the base for future direct artifact renderers and richer per-task agent runtime.

## Shadow AI Memory (Project + Chat)

ShadowCode now includes persistent scoped memory primitives to optimize agent workflows:

- Project Memory: stable repo-level notes (architecture constraints, preferred build paths, policies).
- Chat Memory: short-lived workflow notes (active objective, style constraints, temporary rules).

The default Shadow AI chat agent automatically injects a compact memory summary into system context, reducing repeated prompting and token waste across iterative tasks.

## Auto Model Execution Plan

ShadowCode now has an automatic model execution planner for resilient agent runs:

- Selects best model plan from `defaultModel` and `providerPriority`.
- Retries on rate-limit/capacity/network-style failures using the next model automatically.
- Keeps failures silent when fallback succeeds so user flow stays uninterrupted.
- Retry budget controlled with `shadowAI.maxModelFallbackAttempts`.
- Behavior can be toggled with `shadowAI.autoModelFallback`.

## Project Constitution (for AI Agents)

ShadowCode ships a persistent project context file that Shadow AI automatically loads into every chat session:

```
.shadowcode/AGENT_CONSTITUTION.md
```

This file contains the full architecture overview, key file paths, settings reference, and security policies. Because it's loaded as a system prompt on every session, Shadow AI **does not need to re-read the repo** on each query — it already knows the project structure. If you add new features, update this file so future AI sessions stay current.

---

## License

Copyright (c) ShadowCode Contributors.

Licensed under the MIT license in `LICENSE.txt`.
