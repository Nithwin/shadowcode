/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { addShadowAIMemoryEntry, buildShadowAIMemoryPrompt, createEmptyShadowAIMemoryState, parseShadowAIMemoryState, serializeShadowAIMemoryState } from '../../common/shadowAIMemory.js';

suite('ShadowAIMemory', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('round-trips memory state', () => {
		const state = addShadowAIMemoryEntry(createEmptyShadowAIMemoryState(), 'project', 'Prefer concise diffs');
		const serialized = serializeShadowAIMemoryState(state);
		const parsed = parseShadowAIMemoryState(serialized);
		assert.strictEqual(parsed.project.length, 1);
		assert.strictEqual(parsed.project[0].text, 'Prefer concise diffs');
	});

	test('adds entries to correct scope', () => {
		let state = createEmptyShadowAIMemoryState();
		state = addShadowAIMemoryEntry(state, 'project', 'Use local models first');
		state = addShadowAIMemoryEntry(state, 'chat', 'Continue without pausing');
		assert.deepStrictEqual({ project: state.project.length, chat: state.chat.length }, { project: 1, chat: 1 });
	});

	test('builds memory prompt from both scopes', () => {
		let state = createEmptyShadowAIMemoryState();
		state = addShadowAIMemoryEntry(state, 'project', 'Repo uses tabs for indentation');
		state = addShadowAIMemoryEntry(state, 'chat', 'Ship browser agent first');
		const prompt = buildShadowAIMemoryPrompt(state);
		assert.strictEqual(prompt.includes('Project Memory:'), true);
		assert.strictEqual(prompt.includes('Chat Memory:'), true);
	});
});
