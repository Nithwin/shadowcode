/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

export type ShadowAITaskKind = 'presentation' | 'document' | 'spreadsheet' | 'browserResearch' | 'terminalFix' | 'code';

export interface IShadowAITaskPlanStep {
	readonly title: string;
	readonly agent: string;
	readonly purpose: string;
	readonly computeTier: 'low' | 'medium' | 'high';
}

export interface IShadowAITaskPlan {
	readonly taskKind: ShadowAITaskKind;
	readonly summary: string;
	readonly steps: readonly IShadowAITaskPlanStep[];
}

export function inferShadowAITaskKind(prompt: string): ShadowAITaskKind {
	const normalized = prompt.toLowerCase();

	if (/(ppt|powerpoint|slides|deck|presentation)/.test(normalized)) {
		return 'presentation';
	}

	if (/(spreadsheet|excel|sheet|csv|table model)/.test(normalized)) {
		return 'spreadsheet';
	}

	if (/(doc|document|proposal|report|brief)/.test(normalized)) {
		return 'document';
	}

	if (/(terminal|shell|bash|zsh|command failed|exit code|stderr|traceback)/.test(normalized)) {
		return 'terminalFix';
	}

	if (/(browser|web research|sources|citations|fetch url|search web)/.test(normalized)) {
		return 'browserResearch';
	}

	return 'code';
}

export function buildShadowAITaskPlan(prompt: string): IShadowAITaskPlan {
	const taskKind = inferShadowAITaskKind(prompt);

	switch (taskKind) {
		case 'presentation':
			return {
				taskKind,
				summary: 'Use artifact-first generation for slide decks with visual direction and export strategy.',
				steps: [
					{ title: 'Structure Deck', agent: 'PresentationPlannerAgent', purpose: 'Create narrative arc and slide goals.', computeTier: 'low' },
					{ title: 'Compose Visual Blueprint', agent: 'PresentationDesignAgent', purpose: 'Generate style tokens, palette, and layout hints.', computeTier: 'medium' },
					{ title: 'Build Export Artifact', agent: 'PresentationRenderAgent', purpose: 'Render directly to PPT-like artifact pipeline.', computeTier: 'high' }
				]
			};
		case 'document':
			return {
				taskKind,
				summary: 'Use section-aware writing and revision loops with minimal token usage.',
				steps: [
					{ title: 'Outline Document', agent: 'DocOutlineAgent', purpose: 'Create heading tree and constraints.', computeTier: 'low' },
					{ title: 'Draft Sections', agent: 'DocDraftAgent', purpose: 'Generate sections incrementally.', computeTier: 'medium' },
					{ title: 'Quality and Export', agent: 'DocPolishAgent', purpose: 'Apply tone/style checks and export mapping.', computeTier: 'medium' }
				]
			};
		case 'spreadsheet':
			return {
				taskKind,
				summary: 'Use table schema planning before formula generation for efficiency and correctness.',
				steps: [
					{ title: 'Define Data Schema', agent: 'SheetSchemaAgent', purpose: 'Map columns, types, and constraints.', computeTier: 'low' },
					{ title: 'Generate Formulas', agent: 'SheetFormulaAgent', purpose: 'Create formulas and validation rules.', computeTier: 'medium' },
					{ title: 'Render Workbook', agent: 'SheetRenderAgent', purpose: 'Prepare workbook-level artifact output.', computeTier: 'high' }
				]
			};
		case 'browserResearch':
			return {
				taskKind,
				summary: 'Use lightweight fetch and citation extraction before synthesis.',
				steps: [
					{ title: 'Collect Sources', agent: 'BrowserScoutAgent', purpose: 'Gather candidate pages and metadata.', computeTier: 'low' },
					{ title: 'Extract Facts', agent: 'BrowserExtractAgent', purpose: 'Extract and normalize source snippets.', computeTier: 'medium' },
					{ title: 'Synthesize', agent: 'ResearchSynthesisAgent', purpose: 'Produce concise answer with references.', computeTier: 'medium' }
				]
			};
		case 'terminalFix':
			return {
				taskKind,
				summary: 'Analyze command output first, then propose minimal, verifiable remediation.',
				steps: [
					{ title: 'Classify Failure', agent: 'TerminalDiagnosisAgent', purpose: 'Find root cause from output and exit hints.', computeTier: 'low' },
					{ title: 'Suggest Fix Commands', agent: 'TerminalRepairAgent', purpose: 'Generate deterministic commands with rollback awareness.', computeTier: 'medium' },
					{ title: 'Verify Outcome', agent: 'TerminalValidationAgent', purpose: 'Check output signatures and unresolved errors.', computeTier: 'low' }
				]
			};
		case 'code':
		default:
			return {
				taskKind: 'code',
				summary: 'Use focused coding loop with context compression and validation.',
				steps: [
					{ title: 'Plan Change', agent: 'CodePlannerAgent', purpose: 'Limit scope and dependencies.', computeTier: 'low' },
					{ title: 'Implement', agent: 'CodeWorkerAgent', purpose: 'Apply minimal edits with constraints.', computeTier: 'medium' },
					{ title: 'Validate', agent: 'CodeReviewAgent', purpose: 'Run compile and targeted tests.', computeTier: 'low' }
				]
			};
	}
}
