/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { buildShadowAIModelPlan, resolveProviderPriorityForProfile, shouldFallbackToNextModel } from '../../common/shadowAIModelPlan.js';

suite('ShadowAIModelPlan', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('uses selected model directly', () => {
		const plan = buildShadowAIModelPlan({
			modelIds: ['ollama:codellama', 'groq:mixtral'],
			userSelectedModelId: 'groq:mixtral',
			defaultModel: 'codellama',
			providerPriority: ['ollama', 'groq'],
			workflowProfile: 'balanced',
			maxAttempts: 4
		});
		assert.deepStrictEqual(plan, ['groq:mixtral']);
	});

	test('orders by default and provider priority', () => {
		const plan = buildShadowAIModelPlan({
			modelIds: ['openrouter:qwen', 'groq:mixtral', 'ollama:codellama'],
			userSelectedModelId: undefined,
			defaultModel: 'codellama',
			providerPriority: ['openrouter', 'groq', 'ollama'],
			workflowProfile: 'balanced',
			maxAttempts: 4
		});
		assert.deepStrictEqual(plan.slice(0, 3), ['ollama:codellama', 'openrouter:qwen', 'groq:mixtral']);
	});

	test('offline profile prioritizes only local provider', () => {
		const effective = resolveProviderPriorityForProfile('offline', ['openrouter', 'ollama', 'groq']);
		assert.deepStrictEqual(effective, ['ollama']);
	});

	test('cloud profile prioritizes cloud providers first', () => {
		const effective = resolveProviderPriorityForProfile('cloud', ['ollama', 'openrouter', 'groq']);
		assert.deepStrictEqual(effective.slice(0, 2), ['openrouter', 'groq']);
	});

	test('detects retry-worthy errors', () => {
		assert.strictEqual(shouldFallbackToNextModel(new Error('429 rate limit reached')), true);
		assert.strictEqual(shouldFallbackToNextModel(new Error('provider capacity overloaded')), true);
		assert.strictEqual(shouldFallbackToNextModel(new Error('invalid request body')), false);
	});
});
