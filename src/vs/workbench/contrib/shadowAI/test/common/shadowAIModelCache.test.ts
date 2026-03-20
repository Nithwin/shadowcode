/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ShadowAIModelCache } from '../../common/shadowAIModelCache.js';

suite('ShadowAIModelCache', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('reuses cached value within ttl', async () => {
		const cache = new ShadowAIModelCache<number>();
		let computeCalls = 0;

		const first = await cache.getOrCompute('key', 50, async () => {
			computeCalls++;
			return 42;
		});

		const second = await cache.getOrCompute('key', 50, async () => {
			computeCalls++;
			return 99;
		});

		assert.deepStrictEqual({ first, second, computeCalls }, { first: 42, second: 42, computeCalls: 1 });
	});

	test('expires value after ttl', async () => {
		const cache = new ShadowAIModelCache<number>();
		let computeCalls = 0;

		await cache.getOrCompute('key', 1, async () => {
			computeCalls++;
			return 1;
		});

		await timeout(5);

		const value = await cache.getOrCompute('key', 1, async () => {
			computeCalls++;
			return 2;
		});

		assert.deepStrictEqual({ value, computeCalls }, { value: 2, computeCalls: 2 });
	});

	test('deduplicates pending compute for same key', async () => {
		const cache = new ShadowAIModelCache<number>();
		const deferred = new DeferredPromise<number>();
		let computeCalls = 0;

		const first = cache.getOrCompute('shared', 1000, async () => {
			computeCalls++;
			return deferred.p;
		});

		const second = cache.getOrCompute('shared', 1000, async () => {
			computeCalls++;
			return 999;
		});

		deferred.complete(7);

		const result = await Promise.all([first, second]);
		assert.deepStrictEqual({ result, computeCalls }, { result: [7, 7], computeCalls: 1 });
	});

	test('ttl 0 disables cache persistence', async () => {
		const cache = new ShadowAIModelCache<number>();
		let computeCalls = 0;

		const first = await cache.getOrCompute('key', 0, async () => {
			computeCalls++;
			return 1;
		});

		const second = await cache.getOrCompute('key', 0, async () => {
			computeCalls++;
			return 2;
		});

		assert.deepStrictEqual({ first, second, computeCalls }, { first: 1, second: 2, computeCalls: 2 });
	});
});
