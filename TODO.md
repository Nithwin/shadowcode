# ShadowCode Master TODO

This plan is derived from the original project vision and is now locked to the name **ShadowCode**.

Legend:
- [ ] Not started
- [x] Completed
- Milestones: `M0` (Rebrand), `M1` (Provider Layer), `M2` (Chat), `M3` (Agents), `M4` (Inline AI), `M5` (ShadowDoc), `M6` (Open VSX), `M7` (Release)

## M0 - Cleanup and Rebrand

### Product Identity
- [x] Finalize name: `ShadowCode`
- [ ] Lock product identifiers (`nameShort`, `applicationName`, protocol, Linux desktop ID)
- [ ] Finalize logo, icon set, and app metadata
- [ ] Finalize default dark theme: near-black + violet accent `#7c3aed`

### Remove Microsoft Branding and Links
- [ ] Audit all `product.json` and root metadata for Microsoft references
- [ ] Audit `.github/`, `.vscode/`, and docs for Microsoft references
- [ ] Audit `extensions/**/package.json` metadata URLs for upstream references
- [ ] Replace user-facing docs with ShadowCode-owned links and support channels
- [ ] Keep legal third-party copyright and notice requirements intact

### Telemetry and Network Cleanup
- [ ] Disable Microsoft telemetry by default and remove hardcoded senders
- [ ] Remove or replace Microsoft telemetry libraries where possible
- [ ] Audit runtime endpoints (CDN, issue links, service URLs)
- [ ] Add domain allowlist policy for all outbound calls
- [ ] Add CI guard to block disallowed domains

### Runtime Hardening
- [ ] Replace `vscode-cdn.net` fallbacks with ShadowCode-owned host
- [ ] Re-check webview CSP for allowed hosts only
- [ ] Re-check extension gallery settings to Open VSX defaults
- [ ] Verify offline startup with no cloud dependency

### M0 Validation
- [ ] Typecheck `src` with zero errors
- [ ] Typecheck `build` with zero errors
- [ ] Validate extensions build with zero errors
- [ ] Create `PHASE0_AUDIT.md` with completed/remaining tasks

## M1 - AI Provider Layer

### Provider Architecture
- [ ] Define shared provider contract (`models`, `chat`, `stream`, `health`, `countTokens`)
- [ ] Build provider registry with priority/fallback chain
- [ ] Build shared streaming/SSE parser utilities
- [ ] Add robust retries, timeout, cancellation, and error mapping

### Providers
- [ ] Ollama provider (local, default)
- [ ] Groq provider
- [ ] OpenRouter provider
- [ ] Hugging Face provider
- [ ] Custom OpenAI-compatible provider

### Config and Secrets
- [x] Add provider settings schema and docs
- [x] Move API keys to secure storage flow
- [x] Add per-provider enable/disable switches
- [x] Add model list caching with TTL

### Safety and UX
- [x] Add provider health-check command
- [x] Add provider diagnostics output (latency, errors, active model)
- [x] Add strict API key redaction in logs
- [x] Add offline lock mode to force local provider only

### M1 Validation
- [ ] Unit tests for parsers and adapters
- [ ] Integration tests with mocked providers
- [ ] Manual smoke test for each provider with streaming

## M2 - AI Chat Panel

### Sessions and Context
- [ ] Multi-session chat state and persistence
- [ ] Session rename/pin/archive/export
- [ ] `@context` injection: `@file`, `@selection`, `@folder`, `@diagnostics`, `@gitdiff`
- [ ] Context inspector to show exactly what is sent

### Chat Experience
- [ ] Streaming render with cancel/stop
- [ ] Safe markdown rendering
- [ ] Code block actions (`copy`, `insert`, `replace`, `apply patch`)
- [ ] Model/provider picker in chat composer

### Controls
- [ ] Privacy indicators for cloud provider usage
- [ ] Offline indicator when only local provider is active
- [ ] Command palette integration for key chat actions

### M2 Validation
- [ ] E2E for session lifecycle
- [ ] E2E for `@context` behavior
- [ ] E2E for stream cancellation and recovery

## M3 - Multi-Agent System

### Agent Framework
- [ ] Define runtime loop (`plan`, `act`, `tool`, `reflect`, `finalize`)
- [ ] Add tool permission model and policy checks
- [ ] Add approval gates for destructive actions
- [ ] Add agent run traces and replay

### Agents
- [ ] `CodeAgent`
- [ ] `DebugAgent`
- [ ] `ExplainAgent`
- [ ] `ReviewAgent`
- [ ] `TerminalAgent`
- [ ] `DocAgent`

### Agent Coordination
- [ ] Add multi-agent orchestration mode
- [ ] Add memory scopes (session/workspace/global)
- [ ] Add interruption and resume controls

### M3 Validation
- [ ] Tests for policy enforcement
- [ ] Tests for tool scoping and sandbox behavior

## M4 - Inline AI

### Completion and Commands
- [ ] Ghost text completion provider integration
- [ ] Accept controls (word/line/all)
- [ ] Slash commands: `/fix`, `/explain`, `/test`
- [ ] Inline quick-fix and explain actions

### Smart Editing Features
- [ ] Smart error lens suggestions from diagnostics
- [ ] AI commit message generation from staged diff
- [ ] Refactor-with-AI action for selected code

### M4 Validation
- [ ] Latency benchmarks for inline completion
- [ ] Acceptance quality checks on sample repos

## M5 - ShadowDoc Engine

### Core Format
- [ ] Define `.shadow` schema and validator
- [ ] Build parser + diagnostics for invalid files
- [ ] Implement live preview panel

### AI and Authoring
- [ ] Add AI generation templates for `.shadow`
- [ ] Add markdown import to `.shadow`

### Export Pipeline
- [ ] Export to `.pdf`
- [ ] Export to `.docx`
- [ ] Export to `.xlsx`
- [ ] Export to `.pptx`

### M5 Validation
- [ ] Golden-file tests for export correctness
- [ ] Performance checks for large documents

## M6 - Plugin Marketplace (Open VSX)

### Marketplace Integration
- [ ] Complete Open VSX search/install/update/remove flows
- [ ] Add extension compatibility checks
- [ ] Add extension trust and warning surfaces

### Ecosystem
- [ ] Add migration docs for users switching from VS Code OSS
- [ ] Add extension issue/report links to ShadowCode channels

### M6 Validation
- [ ] E2E tests for extension lifecycle
- [ ] Offline behavior checks when marketplace unavailable

## M7 - Polish and Fedora RPM

### Product Polish
- [ ] Final pass on typography, iconography, and color tokens
- [ ] Onboarding flow: local AI setup first (Ollama)
- [ ] Presets: `offline`, `balanced`, `cloud`

### Packaging and Release
- [ ] RPM spec and dependency setup for Fedora
- [ ] Signed build pipeline for RPM artifacts
- [ ] Clean install/uninstall/upgrade tests in Fedora VM
- [ ] Publish checksums and release notes

### M7 Validation
- [ ] Startup perf baseline
- [ ] Memory budget baseline
- [ ] Crash/error local logging checks

## Cross-Phase Security and Privacy
- [ ] Threat model for provider and agent execution surfaces
- [ ] Secret scanning and credential leak checks
- [ ] Network egress policy tests
- [ ] CSP and webview security review per release

## Cross-Phase CI and Quality
- [ ] Add CI matrix for Linux-first builds
- [x] Add forbidden-domain lint rule
- [ ] Add compile and test quality gates per milestone
- [ ] Add nightly smoke tests

## Immediate Next 20 Tasks
- [ ] Freeze M0 scope and classify remaining branding references
- [ ] Prepare `PHASE0_AUDIT.md` checklist with ownership
- [x] Implement forbidden-domain CI guard
- [ ] Remove remaining telemetry sender paths
- [x] Add provider health check command
- [x] Add provider priority/fallback settings UI
- [x] Add secure key storage migration
- [x] Add provider diagnostics output command
- [ ] Add chat session persistence baseline
- [ ] Add `@file` and `@selection` context first
- [ ] Add slash command router in chat panel
- [x] Add offline lock toggle in status bar
- [ ] Add streamed output cancellation UX polish
- [ ] Add model capability metadata plumbing
- [ ] Add integration tests for OpenRouter and Hugging Face
- [ ] Add initial agent framework skeleton
- [ ] Add agent tool permission policy
- [ ] Add ghost completion skeleton implementation
- [ ] Add `.shadow` schema draft and validator scaffold
- [ ] Add Open VSX extension install smoke tests
- [ ] Create Fedora RPM scaffold and first package build
