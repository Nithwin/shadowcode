/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

export interface IShadowAIModelPlanInput {
	readonly modelIds: readonly string[];
	readonly userSelectedModelId: string | undefined;
	readonly defaultModel: string | undefined;
	readonly providerPriority: readonly string[];
	readonly workflowProfile: 'offline' | 'balanced' | 'cloud';
	readonly maxAttempts: number;
}

export function buildShadowAIModelPlan(input: IShadowAIModelPlanInput): readonly string[] {
	const {
		modelIds,
		userSelectedModelId,
		defaultModel,
		providerPriority,
		workflowProfile,
		maxAttempts
	} = input;

	if (userSelectedModelId) {
		return [userSelectedModelId];
	}

	const ordered: string[] = [];

	if (defaultModel) {
		const exactMatch = modelIds.find(id => id === defaultModel || id.endsWith(`:${defaultModel}`));
		if (exactMatch) {
			ordered.push(exactMatch);
		}
	}

	const effectivePriority = resolveProviderPriorityForProfile(workflowProfile, providerPriority);

	for (const provider of effectivePriority) {
		for (const id of modelIds) {
			if (id.startsWith(`${provider}:`)) {
				ordered.push(id);
			}
		}
	}

	for (const id of modelIds) {
		ordered.push(id);
	}

	const deduped = dedupe(ordered);
	return deduped.slice(0, Math.max(1, maxAttempts));
}

export function resolveProviderPriorityForProfile(profile: 'offline' | 'balanced' | 'cloud', configuredPriority: readonly string[]): readonly string[] {
	const base = dedupe(configuredPriority.length > 0 ? configuredPriority : ['ollama', 'openrouter', 'groq', 'huggingface', 'custom']);

	if (profile === 'offline') {
		return ['ollama', ...base.filter(provider => provider === 'ollama')].slice(0, 1);
	}

	if (profile === 'cloud') {
		const cloudFirst = base.filter(provider => provider !== 'ollama');
		if (cloudFirst.length > 0) {
			return [...cloudFirst, ...base.filter(provider => provider === 'ollama')];
		}
	}

	return base;
}

export function shouldFallbackToNextModel(error: unknown): boolean {
	const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
	return (
		message.includes('429') ||
		message.includes('rate limit') ||
		message.includes('quota') ||
		message.includes('capacity') ||
		message.includes('overloaded') ||
		message.includes('temporarily unavailable') ||
		message.includes('timeout') ||
		message.includes('econnreset') ||
		message.includes('network') ||
		message.includes('connection')
	);
}

function dedupe(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		if (seen.has(value)) {
			continue;
		}
		seen.add(value);
		result.push(value);
	}
	return result;
}
