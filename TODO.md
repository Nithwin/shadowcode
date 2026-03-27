# ShadowCode Master TODO

This roadmap documents what is done, what remains, and how to validate each milestone.
It is aligned to the ShadowCode self-hosting vision: local-first AI development with strong security and clear product identity.

Legend:
- [ ] Not started
- [x] Completed
- Milestones: `M0` (Rebrand), `M1` (Provider Layer), `M2` (Chat), `M3` (Agents), `M4` (Inline AI), `M5` (ShadowDoc), `M6` (Open VSX), `M7` (Release)

Documentation Conventions:
- Each section includes goal, scope, and expected output.
- Validation items should be executable and reproducible.
- If an item is marked done, add proof in commit message, test output, or milestone audit docs.

## M0 - Cleanup and Rebrand

Milestone goal:
- Fully establish ShadowCode identity and remove unintended upstream branding/runtime coupling while preserving legal notices.

### Product Identity
- [x] Finalize name: `ShadowCode`
	- Details: Ensure all top-level user-facing surfaces use ShadowCode consistently.
	- Output: no conflicting product names in primary UI and docs.
- [ ] Lock product identifiers (`nameShort`, `applicationName`, protocol, Linux desktop ID)
	- Details: Normalize values across `product.json`, desktop files, startup metadata, and installer identifiers.
	- Output: stable identifiers for updates, URI handling, and Linux integration.
- [ ] Finalize logo, icon set, and app metadata
	- Details: Replace temporary artwork and verify icon references in all platform bundles.
	- Output: complete branding package for release artifacts.
- [ ] Finalize default dark theme: near-black + violet accent `#7c3aed`
	- Details: Confirm token consistency in workbench, editor, and extensions UI surfaces.
	- Output: cohesive default visual identity.

### Remove Microsoft Branding and Links
- [ ] Audit all `product.json` and root metadata for Microsoft references
	- Details: include URLs, report links, extension gallery references, and support channels.
- [ ] Audit `.github/`, `.vscode/`, and docs for Microsoft references
	- Details: include templates, docs badges, issue links, and code of conduct references where needed.
- [ ] Audit `extensions/**/package.json` metadata URLs for upstream references
	- Details: update homepage/repo/bugs fields where ShadowCode ownership should apply.
- [ ] Replace user-facing docs with ShadowCode-owned links and support channels
	- Details: ensure every broken upstream pointer has a local or owned replacement.
- [ ] Keep legal third-party copyright and notice requirements intact
	- Details: do not remove required attribution files (`ThirdPartyNotices.txt`, license artifacts).

### Telemetry and Network Cleanup
- [ ] Disable Microsoft telemetry by default and remove hardcoded senders
	- Details: cover product config defaults and runtime sender wiring.
- [ ] Remove or replace Microsoft telemetry libraries where possible
	- Details: keep only necessary dependencies and document temporary exceptions.
- [ ] Audit runtime endpoints (CDN, issue links, service URLs)
	- Details: classify by owner and required purpose.
- [ ] Add domain allowlist policy for all outbound calls
	- Details: define approved domains by feature and policy owner.
- [x] Add CI guard to block disallowed domains
	- Details: implemented via `scripts/check-forbidden-domains.sh` and package script integration.

### Runtime Hardening
- [ ] Replace `vscode-cdn.net` fallbacks with ShadowCode-owned host
	- Details: include webviews, static asset paths, and extension web runtime dependencies.
- [ ] Re-check webview CSP for allowed hosts only
	- Details: remove broad host patterns and verify feature-by-feature allowlists.
- [ ] Re-check extension gallery settings to Open VSX defaults
	- Details: confirm search/install/update flows resolve against Open VSX endpoints.
- [ ] Verify offline startup with no cloud dependency
	- Details: test startup path in network-disabled environment.

### M0 Validation
- [ ] Typecheck `src` with zero errors
	- Suggested check: `npm run compile-check-ts-native`
- [ ] Typecheck `build` with zero errors
	- Suggested check: `cd build && npm run typecheck`
- [ ] Validate extensions build with zero errors
	- Suggested check: `npm run gulp compile-extensions`
- [x] Create `PHASE0_AUDIT.md` with completed/remaining tasks
	- Status: baseline audit document exists and tracks progress.

## M1 - AI Provider Layer

Milestone goal:
- Build a provider-agnostic AI execution layer with reliable fallback, secure credential handling, and diagnostics.

### Provider Architecture
- [ ] Define shared provider contract (`models`, `chat`, `stream`, `health`, `countTokens`)
	- Details: explicitly define request/response types and error taxonomy.
- [x] Build provider registry with priority/fallback chain
	- Details: includes provider priority settings and fallback-aware execution planning.
- [ ] Build shared streaming/SSE parser utilities
	- Details: centralize parsing to avoid provider-specific divergence and duplicate bugs.
- [x] Add robust retries, timeout, cancellation, and error mapping
	- Details: retry-worthy errors are detected and mapped for graceful fallback.

### Providers
- [x] Ollama provider (local, default)
	- Details: local-first option for privacy and offline mode.
- [x] Groq provider
	- Details: cloud provider with model listing and runtime checks.
- [x] OpenRouter provider
	- Details: model aggregation provider with diagnostics and key handling.
- [x] Hugging Face provider
	- Details: cloud model integration path with provider gating.
- [x] Custom OpenAI-compatible provider
	- Details: supports user-defined endpoint and model.

### Config and Secrets
- [x] Add provider settings schema and docs
	- Details: includes provider priorities, enablement, and profile-related options.
- [x] Move API keys to secure storage flow
	- Details: settings values migrate to secret storage and avoid plaintext persistence.
- [x] Add per-provider enable/disable switches
	- Details: provider access guard enforces runtime eligibility.
- [x] Add model list caching with TTL
	- Details: avoids redundant requests and supports configurable cache freshness.

### Safety and UX
- [x] Add provider health-check command
	- Details: user command to quickly verify configured provider reachability.
- [x] Add provider diagnostics output (latency, errors, active model)
	- Details: one-command summary for support/debug workflows.
- [x] Add strict API key redaction in logs
	- Details: sanitize bearer tokens, query keys, and JSON-like secret assignments.
- [x] Add offline lock mode to force local provider only
	- Details: cloud providers are blocked when offline lock is enabled.

### M1 Validation
- [x] Unit tests for core helper modules and adapters
	- Evidence: focused ShadowAI test groups include model plan/cache/provider access/redaction/memory/task router.
- [ ] Integration tests with mocked providers
	- Details: add multi-provider fallback chain tests with simulated quota/network failures.
- [ ] Manual smoke test for each provider with streaming
	- Details: validate streaming UX and error handling across all configured providers.

## M2 - AI Chat Panel

Milestone goal:
- Deliver robust chat workflows with explicit context control and production-ready session behavior.

### Sessions and Context
- [ ] Multi-session chat state and persistence
	- Details: persist active and historical sessions with recovery after restart.
- [ ] Session rename/pin/archive/export
	- Details: include lifecycle UX and command palette actions.
- [ ] `@context` injection: `@file`, `@selection`, `@folder`, `@diagnostics`, `@gitdiff`
	- Details: deterministic context assembly with per-source token budgeting.
- [ ] Context inspector to show exactly what is sent
	- Details: transparency view for privacy and debugging.

### Chat Experience
- [ ] Streaming render with cancel/stop
	- Details: user can interrupt model output without corrupting session state.
- [ ] Safe markdown rendering
	- Details: sanitize HTML/script vectors while preserving code and formatting.
- [ ] Code block actions (`copy`, `insert`, `replace`, `apply patch`)
	- Details: integrate with editor APIs and undo stack safely.
- [x] Model/provider picker in chat composer
	- Details: provider model listing and routing controls are available from ShadowAI commands.

### Controls
- [ ] Privacy indicators for cloud provider usage
	- Details: visible state when prompt content will leave local machine.
- [x] Offline indicator when only local provider is active
	- Details: offline lock and provider gating behavior already surfaced through commands/settings.
- [x] Command palette integration for key chat actions
	- Details: diagnostics, provider tests, and workflow utilities are exposed as commands.

### M2 Validation
- [ ] E2E for session lifecycle
	- Details: create/rename/archive/export/recover session flows.
- [ ] E2E for `@context` behavior
	- Details: verify payload inclusion and exclusion rules.
- [ ] E2E for stream cancellation and recovery
	- Details: cancel mid-response and confirm next request remains stable.

## M3 - Multi-Agent System

Milestone goal:
- Move from single-turn chat to orchestrated, policy-aware agent execution.

### Agent Framework
- [ ] Define runtime loop (`plan`, `act`, `tool`, `reflect`, `finalize`)
	- Details: establish state machine, checkpoints, and failure semantics.
- [ ] Add tool permission model and policy checks
	- Details: explicit allow/deny control before tool execution.
- [ ] Add approval gates for destructive actions
	- Details: require user confirmation for file deletion, shell mutations, etc.
- [ ] Add agent run traces and replay
	- Details: timeline view for reproducibility and debugging.

### Agents
- [ ] `CodeAgent`
	- Details: implement/edit/refactor with project constraints.
- [ ] `DebugAgent`
	- Details: log/error triage with fix proposals.
- [ ] `ExplainAgent`
	- Details: explain architecture, data flow, and behavior.
- [ ] `ReviewAgent`
	- Details: risk-focused review and testing recommendations.
- [ ] `TerminalAgent`
	- Details: command planning and result interpretation.
- [ ] `DocAgent`
	- Details: docs generation and consistency checks.

### Agent Coordination
- [ ] Add multi-agent orchestration mode
	- Details: handoffs between specialized agents with a shared objective.
- [x] Add memory scopes (session/workspace/global)
	- Details: foundational memory implementation added for project/chat memory context.
- [ ] Add interruption and resume controls
	- Details: pause long runs and continue from a safe checkpoint.

### M3 Validation
- [ ] Tests for policy enforcement
	- Details: verify denial paths and confirmation flows.
- [ ] Tests for tool scoping and sandbox behavior
	- Details: ensure forbidden tools/paths cannot be executed.

## M4 - Inline AI

Milestone goal:
- Provide low-latency in-editor assistance that augments coding flow without disrupting it.

### Completion and Commands
- [ ] Ghost text completion provider integration
	- Details: connect completion backend to editor suggestion lifecycle.
- [ ] Accept controls (word/line/all)
	- Details: parity with modern inline completion UX.
- [ ] Slash commands: `/fix`, `/explain`, `/test`
	- Details: route to task-specific plans and prompt templates.
- [ ] Inline quick-fix and explain actions
	- Details: surface contextually from diagnostics and selections.

### Smart Editing Features
- [ ] Smart error lens suggestions from diagnostics
	- Details: combine static diagnostics with AI patch suggestions.
- [ ] AI commit message generation from staged diff
	- Details: propose concise, accurate commit titles/bodies.
- [ ] Refactor-with-AI action for selected code
	- Details: local diff preview before apply.

### M4 Validation
- [ ] Latency benchmarks for inline completion
	- Details: measure p50/p95 in local and cloud configurations.
- [ ] Acceptance quality checks on sample repos
	- Details: human review scorecard for relevance/correctness.

## M5 - ShadowDoc Engine

Milestone goal:
- Introduce an AI-native authoring format and multi-format export pipeline.

### Core Format
- [ ] Define `.shadow` schema and validator
	- Details: schema versioning, strict parser errors, and migration strategy.
- [ ] Build parser + diagnostics for invalid files
	- Details: actionable diagnostics with file/line references.
- [ ] Implement live preview panel
	- Details: split-view editing with incremental render updates.

### AI and Authoring
- [ ] Add AI generation templates for `.shadow`
	- Details: prompt templates for reports, decks, and technical docs.
- [ ] Add markdown import to `.shadow`
	- Details: preserve heading hierarchy and code blocks.

### Export Pipeline
- [ ] Export to `.pdf`
	- Details: pagination control and typography consistency.
- [ ] Export to `.docx`
	- Details: style mapping and document metadata support.
- [ ] Export to `.xlsx`
	- Details: sheet/table generation from structured sections.
- [ ] Export to `.pptx`
	- Details: slide layouts with title/content mapping.

### M5 Validation
- [ ] Golden-file tests for export correctness
	- Details: deterministic output checks on representative fixtures.
- [ ] Performance checks for large documents
	- Details: memory/time budget for large multi-section docs.

## M6 - Plugin Marketplace (Open VSX)

Milestone goal:
- Ensure extension ecosystem parity using Open VSX as primary marketplace.

### Marketplace Integration
- [ ] Complete Open VSX search/install/update/remove flows
	- Details: verify all extension lifecycle actions work in product UI.
- [ ] Add extension compatibility checks
	- Details: detect API/version mismatch and warn clearly.
- [ ] Add extension trust and warning surfaces
	- Details: show source/trust status before install/enable.

### Ecosystem
- [ ] Add migration docs for users switching from VS Code OSS
	- Details: explain settings transfer, extension alternatives, and caveats.
- [ ] Add extension issue/report links to ShadowCode channels
	- Details: route support to owned issue/help endpoints.

### M6 Validation
- [ ] E2E tests for extension lifecycle
	- Details: install, update, disable, uninstall, reload flows.
- [ ] Offline behavior checks when marketplace unavailable
	- Details: graceful error messaging and cached metadata usage.

## M7 - Polish and Fedora RPM

Milestone goal:
- Ship a polished Linux-first release with reproducible packaging and operational quality gates.

### Product Polish
- [ ] Final pass on typography, iconography, and color tokens
	- Details: remove inconsistent UI surfaces and legacy visual artifacts.
- [ ] Onboarding flow: local AI setup first (Ollama)
	- Details: guided first-run experience with setup checks.
- [ ] Presets: `offline`, `balanced`, `cloud`
	- Details: one-click profile setting bundles for common user modes.

### Packaging and Release
- [ ] RPM spec and dependency setup for Fedora
	- Details: package metadata, runtime deps, desktop integration.
- [ ] Signed build pipeline for RPM artifacts
	- Details: CI signing and verification workflow.
- [ ] Clean install/uninstall/upgrade tests in Fedora VM
	- Details: verify config migration and artifact cleanup behavior.
- [ ] Publish checksums and release notes
	- Details: release provenance and user-facing changelog.

### M7 Validation
- [ ] Startup perf baseline
	- Details: measure cold/warm startup on representative Linux hardware.
- [ ] Memory budget baseline
	- Details: define acceptable idle/load memory ceilings.
- [ ] Crash/error local logging checks
	- Details: verify actionable local diagnostics without telemetry dependency.

## Cross-Phase Security and Privacy

Objective:
- Apply a repeatable security baseline across provider integration, agent execution, and extension/runtime surfaces.

- [ ] Threat model for provider and agent execution surfaces
	- Output: documented abuse cases, mitigations, and ownership.
- [ ] Secret scanning and credential leak checks
	- Output: pre-commit/CI coverage for keys/tokens.
- [ ] Network egress policy tests
	- Output: tests prove only allowlisted domains are reachable.
- [ ] CSP and webview security review per release
	- Output: release checklist item with sign-off notes.

## Cross-Phase CI and Quality

Objective:
- Make quality gates automatic and milestone-aware.

- [ ] Add CI matrix for Linux-first builds
	- Details: include core compile/typecheck and essential tests.
- [x] Add forbidden-domain lint rule
	- Details: disallowed domain references are blocked in CI checks.
- [ ] Add compile and test quality gates per milestone
	- Details: require milestone-specific suites before merge.
- [ ] Add nightly smoke tests
	- Details: run broad end-to-end sanity checks against main.

## Immediate Next 20 Tasks (Execution Backlog)

Purpose:
- This is the short-horizon queue for active implementation. Keep each item linked to one milestone and add owner/date in future updates.

- [ ] Freeze M0 scope and classify remaining branding references
	- Milestone: `M0`
- [ ] Prepare `PHASE0_AUDIT.md` checklist with ownership
	- Milestone: `M0`
- [x] Implement forbidden-domain CI guard
	- Milestone: `M0`
- [ ] Remove remaining telemetry sender paths
	- Milestone: `M0`
- [x] Add provider health check command
	- Milestone: `M1`
- [x] Add provider priority/fallback settings UI
	- Milestone: `M1`
- [x] Add secure key storage migration
	- Milestone: `M1`
- [x] Add provider diagnostics output command
	- Milestone: `M1`
- [ ] Add chat session persistence baseline
	- Milestone: `M2`
- [ ] Add `@file` and `@selection` context first
	- Milestone: `M2`
- [ ] Add slash command router in chat panel
	- Milestone: `M2`
- [x] Add offline lock toggle in status bar
	- Milestone: `M1/M2`
- [ ] Add streamed output cancellation UX polish
	- Milestone: `M2`
- [ ] Add model capability metadata plumbing
	- Milestone: `M1/M2`
- [ ] Add integration tests for OpenRouter and Hugging Face
	- Milestone: `M1`
- [ ] Add initial agent framework skeleton
	- Milestone: `M3`
- [ ] Add agent tool permission policy
	- Milestone: `M3`
- [ ] Add ghost completion skeleton implementation
	- Milestone: `M4`
- [ ] Add `.shadow` schema draft and validator scaffold
	- Milestone: `M5`
- [ ] Add Open VSX extension install smoke tests
	- Milestone: `M6`
- [ ] Create Fedora RPM scaffold and first package build
	- Milestone: `M7`
