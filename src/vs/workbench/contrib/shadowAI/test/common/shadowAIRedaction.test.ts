/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { sanitizeShadowAIErrorMessage } from '../../common/shadowAIRedaction.js';

suite('ShadowAIRedaction', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('redacts bearer and token query values', () => {
		const input = 'Request failed: Authorization: Bearer abcDEF123_-= token=secret123&api_key=xyz';
		const output = sanitizeShadowAIErrorMessage(input);
		assert.strictEqual(output.includes('Bearer [REDACTED]'), true);
		assert.strictEqual(output.includes('secret123'), false);
		assert.strictEqual(output.includes('api_key=xyz'), false);
	});

	test('redacts provider key formats', () => {
		const input = 'keys sk-thisIsSecret hf_abcd1234efgh5678 remain hidden';
		const output = sanitizeShadowAIErrorMessage(input);
		assert.deepStrictEqual(output, 'keys [REDACTED] [REDACTED] remain hidden');
	});

	test('redacts json-like token and apiKey assignments', () => {
		const input = '{"token":"abc123", "api_key": value123, access_token=abc}';
		const output = sanitizeShadowAIErrorMessage(input);
		assert.strictEqual(output.includes('abc123'), false);
		assert.strictEqual(output.includes('value123'), false);
		assert.strictEqual(output.includes('access_token=abc'), false);
		assert.strictEqual(output.includes('[REDACTED]'), true);
	});
});
