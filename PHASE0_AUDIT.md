# Phase 0 Audit - ShadowCode

Scope: Cleanup and rebrand of VS Code OSS fork into ShadowCode while preserving legal attribution requirements.

Status legend:
- DONE: completed and validated
- IN_PROGRESS: partially complete, needs follow-up
- TODO: not started

## Product Identity
- DONE: Product name locked to `ShadowCode`
- IN_PROGRESS: Product metadata normalization across all extension manifests
- TODO: Final logo and icon pass across app/package assets

## Branding and Links
- IN_PROGRESS: Root docs updated (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.devcontainer/README.md`)
- IN_PROGRESS: Repository and issue URLs updated in key root metadata (`package.json`, `product.json`)
- TODO: Full repository-wide pass for upstream references in non-runtime tooling assets

## Telemetry and Network
- IN_PROGRESS: Core Microsoft CDN runtime fallbacks replaced in key webview/runtime paths
- DONE: Remove/replace Microsoft telemetry dependencies and sender wiring
- DONE: Added forbidden-domain guard script (`scripts/check-forbidden-domains.sh`) and npm task (`check-forbidden-domains`)
- TODO: Add outbound domain allowlist policy document

## Runtime and Security Hardening
- IN_PROGRESS: Webview endpoint and CSP host alignment to ShadowCode domains
- TODO: Full CSP review for all web-facing surfaces
- TODO: Offline startup verification matrix

## AI Provider Foundation (Phase 1 starter work)
- DONE: Added providers for Ollama, Groq, OpenRouter, Hugging Face, Custom OpenAI-compatible
- DONE: Added provider settings schema for endpoints/keys/models
- DONE: Documented all Shadow AI settings and provider controls in `README.md`
- DONE: Added `Shadow AI: Test Providers` command (`shadowAI.testProviders`)
- DONE: Added secure storage migration for cloud provider API keys
- DONE: Added model list caching with configurable TTL (`shadowAI.modelListCacheTtlMs`) across providers
- DONE: Added `Shadow AI: Provider Diagnostics` command (`shadowAI.providerDiagnostics`) with latency/error summaries
- DONE: Added strict API key/token redaction for surfaced provider errors and diagnostics output
- DONE: Added `shadowAI.offlineLock` mode to enforce local-only operation by disabling cloud providers
- DONE: Added offline lock toggle command (`shadowAI.toggleOfflineLock`) in chat toolbar/command palette
- DONE: Added provider priority fallback setting (`shadowAI.providerPriority`) for automatic model selection order
- DONE: Added provider enable/disable setting (`shadowAI.enabledProviders`) and runtime enforcement across providers

## Validation
- DONE: `Core - Typecheck` passing after latest Shadow AI and command wiring changes
- TODO: Run and record extension build validation for Shadow AI feature path
- TODO: Add targeted integration tests for provider model resolution and streaming

## Exit Criteria for Phase 0
- [ ] No Microsoft telemetry endpoints in runtime defaults
- [ ] No unintended Microsoft branding in user-facing product surfaces
- [ ] Open VSX marketplace path verified end-to-end
- [ ] Domain guard present in CI
- [ ] Phase 0 validation checklist executed and documented
