/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

interface IShadowAIModelCacheEntry<T> {
	readonly key: string;
	readonly value: T;
	readonly expiresAt: number;
}

interface IShadowAIModelCachePending<T> {
	readonly key: string;
	readonly promise: Promise<T>;
}

export class ShadowAIModelCache<T> {

	private entry: IShadowAIModelCacheEntry<T> | undefined;
	private pending: IShadowAIModelCachePending<T> | undefined;

	clear(): void {
		this.entry = undefined;
		this.pending = undefined;
	}

	async getOrCompute(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
		if (ttlMs > 0 && this.entry && this.entry.key === key && this.entry.expiresAt > Date.now()) {
			return this.entry.value;
		}

		if (this.pending && this.pending.key === key) {
			return this.pending.promise;
		}

		const promise = compute();
		this.pending = { key, promise };

		try {
			const value = await promise;
			if (ttlMs > 0) {
				this.entry = {
					key,
					value,
					expiresAt: Date.now() + ttlMs
				};
			}
			return value;
		} finally {
			if (this.pending?.promise === promise) {
				this.pending = undefined;
			}
		}
	}
}
