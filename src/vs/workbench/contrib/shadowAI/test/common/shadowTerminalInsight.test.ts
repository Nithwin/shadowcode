/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { analyzeShadowTerminalOutput } from '../../common/shadowTerminalInsight.js';

suite('ShadowTerminalInsight', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('detects missing command category', () => {
		const insight = analyzeShadowTerminalOutput('pnpm: command not found');
		assert.deepStrictEqual({ category: insight.category, confidence: insight.confidence > 0.8 }, { category: 'missingCommand', confidence: true });
	});

	test('detects typescript category', () => {
		const insight = analyzeShadowTerminalOutput('Finished compilation with 3 errors and TS2304');
		assert.deepStrictEqual(insight.category, 'typescript');
	});

	test('returns generic insight when no pattern matches', () => {
		const insight = analyzeShadowTerminalOutput('all good');
		assert.deepStrictEqual(insight.category, 'generic');
	});
});
