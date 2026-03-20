/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { buildShadowAITaskPlan, inferShadowAITaskKind } from '../../common/shadowAITaskRouter.js';

suite('ShadowAITaskRouter', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('infers presentation task from prompt', () => {
		assert.strictEqual(inferShadowAITaskKind('Create a modern PPT for product launch'), 'presentation');
	});

	test('infers terminal task from prompt', () => {
		assert.strictEqual(inferShadowAITaskKind('terminal command failed with stderr'), 'terminalFix');
	});

	test('builds multi-step task plan', () => {
		const plan = buildShadowAITaskPlan('Create an investor presentation');
		assert.deepStrictEqual({ taskKind: plan.taskKind, stepCount: plan.steps.length }, { taskKind: 'presentation', stepCount: 3 });
	});
});
