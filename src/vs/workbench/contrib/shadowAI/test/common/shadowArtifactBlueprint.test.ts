/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createShadowArtifactBlueprint } from '../../common/shadowArtifactBlueprint.js';

suite('ShadowArtifactBlueprint', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('creates presentation blueprint', () => {
		const blueprint = createShadowArtifactBlueprint('presentation', 'Quarterly roadmap');
		assert.strictEqual(blueprint.includes('artifact: presentation'), true);
		assert.strictEqual(blueprint.includes('slide: Solution'), true);
	});

	test('creates document blueprint', () => {
		const blueprint = createShadowArtifactBlueprint('document', 'Security report');
		assert.strictEqual(blueprint.includes('artifact: document'), true);
		assert.strictEqual(blueprint.includes('section: Recommendation'), true);
	});

	test('creates spreadsheet blueprint', () => {
		const blueprint = createShadowArtifactBlueprint('spreadsheet', 'Budget tracker');
		assert.strictEqual(blueprint.includes('artifact: spreadsheet'), true);
		assert.strictEqual(blueprint.includes('sheet: Dashboard'), true);
	});
});
