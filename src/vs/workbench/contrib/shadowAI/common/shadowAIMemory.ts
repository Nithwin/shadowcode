/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const SHADOW_AI_MEMORY_STORAGE_KEY = 'shadowAI.memory.v1';

export type ShadowAIMemoryScope = 'project' | 'chat';

export interface IShadowAIMemoryEntry {
	readonly text: string;
	readonly createdAt: number;
	readonly tags?: readonly string[];
}

export interface IShadowAIMemoryState {
	readonly project: readonly IShadowAIMemoryEntry[];
	readonly chat: readonly IShadowAIMemoryEntry[];
}

export function createEmptyShadowAIMemoryState(): IShadowAIMemoryState {
	return {
		project: [],
		chat: []
	};
}

export function parseShadowAIMemoryState(raw: string | undefined): IShadowAIMemoryState {
	if (!raw) {
		return createEmptyShadowAIMemoryState();
	}

	try {
		const parsed = JSON.parse(raw) as Partial<IShadowAIMemoryState>;
		const project = sanitizeMemoryEntries(parsed.project);
		const chat = sanitizeMemoryEntries(parsed.chat);
		return { project, chat };
	} catch {
		return createEmptyShadowAIMemoryState();
	}
}

export function serializeShadowAIMemoryState(state: IShadowAIMemoryState): string {
	return JSON.stringify(state);
}

export function addShadowAIMemoryEntry(
	state: IShadowAIMemoryState,
	scope: ShadowAIMemoryScope,
	text: string,
	tags: readonly string[] = [],
	maxEntries = 80
): IShadowAIMemoryState {
	const normalizedText = text.trim();
	if (!normalizedText) {
		return state;
	}

	const entry: IShadowAIMemoryEntry = {
		text: normalizedText,
		createdAt: Date.now(),
		tags: tags.filter(Boolean)
	};

	const bucket = scope === 'project' ? state.project : state.chat;
	const updatedBucket = [entry, ...bucket].slice(0, maxEntries);

	if (scope === 'project') {
		return { project: updatedBucket, chat: state.chat };
	}

	return { project: state.project, chat: updatedBucket };
}

export function buildShadowAIMemoryPrompt(state: IShadowAIMemoryState, maxEntriesPerScope = 5): string {
	const project = state.project.slice(0, maxEntriesPerScope);
	const chat = state.chat.slice(0, maxEntriesPerScope);

	if (project.length === 0 && chat.length === 0) {
		return '';
	}

	const lines: string[] = ['Shadow Memory Context:'];

	if (project.length > 0) {
		lines.push('Project Memory:');
		for (const entry of project) {
			lines.push(`- ${entry.text}`);
		}
	}

	if (chat.length > 0) {
		lines.push('Chat Memory:');
		for (const entry of chat) {
			lines.push(`- ${entry.text}`);
		}
	}

	return lines.join('\n');
}

function sanitizeMemoryEntries(entries: unknown): readonly IShadowAIMemoryEntry[] {
	if (!Array.isArray(entries)) {
		return [];
	}

	const result: IShadowAIMemoryEntry[] = [];
	for (const value of entries) {
		if (!value || typeof value !== 'object') {
			continue;
		}

		const candidate = value as { text?: unknown; createdAt?: unknown; tags?: unknown };
		if (typeof candidate.text !== 'string' || typeof candidate.createdAt !== 'number') {
			continue;
		}

		result.push({
			text: candidate.text,
			createdAt: candidate.createdAt,
			tags: Array.isArray(candidate.tags) ? candidate.tags.filter(tag => typeof tag === 'string') : []
		});
	}

	return result;
}
