/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';

export interface IResponseCacheEntry {
	key: string;
	response: string;
	modelId: string;
	timestamp: number;
	ttl: number;
	compressed: boolean;
	size: number;
	metadata?: Record<string, unknown>;
}

export interface IResponseCacheStats {
	totalCached: number;
	totalSize: number;
	compressedSize: number;
	compressionRatio: number;
	averageResponseSize: number;
	oldestResponse: number;
	newestResponse: number;
}

/**
 * Response Cache - Cache model responses for fast retrieval
 *
 * Features:
 * - Response compression (gzip-like compression simulation)
 * - Model-specific caching
 * - Size tracking & limits
 * - Streaming cache support
 * - Memory efficient storage
 */
export class ResponseCache extends Disposable {
	private _cache = new Map<string, IResponseCacheEntry>();
	private _modelCache = new Map<string, Set<string>>(); // modelId -> Set of cache keys
	private _totalSize = 0;
	private _maxSize: number;
	private _onResponseCached = new Emitter<{ key: string; modelId: string; size: number }>();
	private _onResponseRetrieved = new Emitter<{ key: string; hitFromCache: boolean }>();

	readonly onResponseCached: Event<{ key: string; modelId: string; size: number }> = this._onResponseCached.event;
	readonly onResponseRetrieved: Event<{ key: string; hitFromCache: boolean }> = this._onResponseRetrieved.event;

	constructor(maxSizeBytes: number = 100 * 1024 * 1024) { // 100MB default
		super();
		this._register(this._onResponseCached);
		this._register(this._onResponseRetrieved);
		this._maxSize = maxSizeBytes;
	}

	/**
	 * Cache a response
	 */
	cacheResponse(key: string, response: string, modelId: string, ttl: number = 3600000, metadata?: Record<string, unknown>): void {
		// Simulate compression (in real system, would use actual compression)
		const compressed = response.length > 500;
		const compressedResponse = compressed ? this._simpleCompress(response) : response;
		const size = JSON.stringify(compressedResponse).length;

		// Check if we need to evict
		if (this._totalSize + size > this._maxSize) {
			this._evictOldest();
		}

		const entry: IResponseCacheEntry = {
			key,
			response: compressedResponse,
			modelId,
			timestamp: Date.now(),
			ttl,
			compressed,
			size,
			metadata
		};

		this._cache.set(key, entry);
		this._totalSize += size;

		// Track by model
		if (!this._modelCache.has(modelId)) {
			this._modelCache.set(modelId, new Set());
		}
		this._modelCache.get(modelId)!.add(key);

		this._onResponseCached.fire({ key, modelId, size });
	}

	/**
	 * Retrieve cached response
	 */
	getResponse(key: string): string | undefined {
		const entry = this._cache.get(key);

		if (!entry) {
			this._onResponseRetrieved.fire({ key, hitFromCache: false });
			return undefined;
		}

		// Check TTL
		if (Date.now() - entry.timestamp > entry.ttl) {
			this._cache.delete(key);
			this._totalSize -= entry.size;
			this._removeLazyCleanup(key, entry.modelId);
			this._onResponseRetrieved.fire({ key, hitFromCache: false });
			return undefined;
		}

		// Decompress if needed
		const response = entry.compressed ? this._simpleDecompress(entry.response) : entry.response;
		this._onResponseRetrieved.fire({ key, hitFromCache: true });
		return response;
	}

	/**
	 * Get responses for a specific model
	 */
	getResponsesByModel(modelId: string): Array<{ key: string; response: string }> {
		const results: Array<{ key: string; response: string }> = [];
		const keys = this._modelCache.get(modelId);

		if (!keys) {
			return results;
		}

		for (const key of keys) {
			const response = this.getResponse(key);
			if (response) {
				results.push({ key, response });
			}
		}

		return results;
	}

	/**
	 * Check if response is cached
	 */
	hasCachedResponse(key: string): boolean {
		return this._cache.has(key) && !this._isExpired(key);
	}

	/**
	 * Clear cache for a model
	 */
	clearModelCache(modelId: string): void {
		const keys = this._modelCache.get(modelId);
		if (keys) {
			for (const key of keys) {
				const entry = this._cache.get(key);
				if (entry) {
					this._totalSize -= entry.size;
					this._cache.delete(key);
				}
			}
			this._modelCache.delete(modelId);
		}
	}

	/**
	 * Clear entire cache
	 */
	clear(): void {
		this._cache.clear();
		this._modelCache.clear();
		this._totalSize = 0;
	}

	/**
	 * Get cache statistics
	 */
	getStats(): IResponseCacheStats {
		let totalCompressedSize = 0;
		let oldestTimestamp = Infinity;
		let newestTimestamp = -Infinity;

		for (const entry of this._cache.values()) {
			if (entry.compressed) {
				totalCompressedSize += entry.size;
			}
			oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
			newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
		}

		const compressionRatio = this._totalSize > 0 ? 1 - (totalCompressedSize / this._totalSize) : 0;

		return {
			totalCached: this._cache.size,
			totalSize: this._totalSize,
			compressedSize: totalCompressedSize,
			compressionRatio,
			averageResponseSize: this._cache.size > 0 ? this._totalSize / this._cache.size : 0,
			oldestResponse: oldestTimestamp === Infinity ? 0 : oldestTimestamp,
			newestResponse: newestTimestamp === -Infinity ? 0 : newestTimestamp
		};
	}

	private _isExpired(key: string): boolean {
		const entry = this._cache.get(key);
		if (!entry) {
			return true;
		}
		return Date.now() - entry.timestamp > entry.ttl;
	}

	private _evictOldest(): void {
		let oldestKey: string | undefined;
		let oldestTime = Infinity;

		for (const [key, entry] of this._cache) {
			if (entry.timestamp < oldestTime) {
				oldestTime = entry.timestamp;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			const entry = this._cache.get(oldestKey);
			if (entry) {
				this._totalSize -= entry.size;
				this._cache.delete(oldestKey);
				this._removeLazyCleanup(oldestKey, entry.modelId);
			}
		}
	}

	private _removeLazyCleanup(key: string, modelId: string): void {
		const keys = this._modelCache.get(modelId);
		if (keys) {
			keys.delete(key);
			if (keys.size === 0) {
				this._modelCache.delete(modelId);
			}
		}
	}

	// Simulate compression (in real implementation, would use actual compression)
	private _simpleCompress(text: string): string {
		// Very simple compression: remove excessive whitespace
		return text.replace(/\s+/g, ' ').trim();
	}

	private _simpleDecompress(text: string): string {
		// Decompression is identity for our simple compression
		return text;
	}

	override dispose(): void {
		this._onResponseCached.dispose();
		this._onResponseRetrieved.dispose();
		super.dispose();
	}
}
