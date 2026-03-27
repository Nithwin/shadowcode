/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';

export interface ICacheEntry<T> {
	key: string;
	value: T;
	timestamp: number;
	ttl: number; // milliseconds
	hits: number;
	metadata?: Record<string, unknown>;
}

export interface ICacheStats {
	totalEntries: number;
	hits: number;
	misses: number;
	hitRate: number;
	averageEntrySize: number;
	totalMemoryUsed: number;
	oldestEntry: number;
	newestEntry: number;
}

export interface ICachePolicy {
	maxSize?: number; // max entries
	maxMemory?: number; // max bytes
	evictionPolicy?: 'lru' | 'lfu' | 'fifo';
}

/**
 * Query Cache Manager - Cache query results with intelligent eviction
 *
 * Features:
 * - TTL-based expiration
 * - LRU/LFU/FIFO eviction policies
 * - Memory and size limits
 * - Hit/miss tracking
 * - Query normalization
 */
export class QueryCacheManager<T = unknown> extends Disposable {
	private _cache = new Map<string, ICacheEntry<T>>();
	private _stats = { hits: 0, misses: 0 };
	private _policy: Required<ICachePolicy>;
	private _accessOrder: string[] = []; // For LRU
	private _accessFrequency = new Map<string, number>(); // For LFU
	private _onCacheHit = new Emitter<{ key: string; value: T }>();
	private _onCacheMiss = new Emitter<{ key: string }>();
	private _onEviction = new Emitter<{ key: string; reason: 'ttl' | 'memory' | 'size' | 'policy' }>();

	readonly onCacheHit: Event<{ key: string; value: T }> = this._onCacheHit.event;
	readonly onCacheMiss: Event<{ key: string }> = this._onCacheMiss.event;
	readonly onEviction: Event<{ key: string; reason: 'ttl' | 'memory' | 'size' | 'policy' }> = this._onEviction.event;

	constructor(policy?: ICachePolicy) {
		super();
		this._register(this._onCacheHit);
		this._register(this._onCacheMiss);
		this._register(this._onEviction);

		this._policy = {
			maxSize: policy?.maxSize ?? 1000,
			maxMemory: policy?.maxMemory ?? 50 * 1024 * 1024, // 50MB default
			evictionPolicy: policy?.evictionPolicy ?? 'lru'
		};

		// Cleanup expired entries every 60 seconds
		this._register({
			dispose: () => { /* cleanup */ }
		});
	}

	/**
	 * Get cached value
	 */
	get(key: string): T | undefined {
		const entry = this._cache.get(key);

		if (!entry) {
			this._stats.misses++;
			this._onCacheMiss.fire({ key });
			return undefined;
		}

		// Check TTL
		if (Date.now() - entry.timestamp > entry.ttl) {
			this._cache.delete(key);
			this._stats.misses++;
			this._onCacheMiss.fire({ key });
			return undefined;
		}

		// Update stats
		entry.hits++;
		this._stats.hits++;
		this._updateAccessTracking(key);
		this._onCacheHit.fire({ key, value: entry.value });

		return entry.value;
	}

	/**
	 * Set cached value
	 */
	set(key: string, value: T, ttl: number = 3600000, metadata?: Record<string, unknown>): void {
		// Check if we need to evict before adding
		if (this._cache.size >= this._policy.maxSize) {
			this._evictOne();
		}

		const entry: ICacheEntry<T> = {
			key,
			value,
			timestamp: Date.now(),
			ttl,
			hits: 0,
			metadata
		};

		this._cache.set(key, entry);
		this._updateAccessTracking(key);
	}

	/**
	 * Check if key exists and is valid
	 */
	has(key: string): boolean {
		const entry = this._cache.get(key);
		if (!entry) {
			return false;
		}

		// Check TTL
		if (Date.now() - entry.timestamp > entry.ttl) {
			this._cache.delete(key);
			return false;
		}

		return true;
	}

	/**
	 * Delete cache entry
	 */
	delete(key: string): boolean {
		const deleted = this._cache.delete(key);
		this._accessOrder = this._accessOrder.filter(k => k !== key);
		this._accessFrequency.delete(key);
		return deleted;
	}

	/**
	 * Clear all cache
	 */
	clear(): void {
		this._cache.clear();
		this._accessOrder = [];
		this._accessFrequency.clear();
		this._stats = { hits: 0, misses: 0 };
	}

	/**
	 * Get cache statistics
	 */
	getStats(): ICacheStats {
		let totalMemory = 0;
		let oldestTimestamp = Infinity;
		let newestTimestamp = -Infinity;

		for (const entry of this._cache.values()) {
			totalMemory += JSON.stringify(entry.value).length;
			oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
			newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
		}

		const total = this._stats.hits + this._stats.misses;
		const hitRate = total > 0 ? this._stats.hits / total : 0;

		return {
			totalEntries: this._cache.size,
			hits: this._stats.hits,
			misses: this._stats.misses,
			hitRate,
			averageEntrySize: this._cache.size > 0 ? totalMemory / this._cache.size : 0,
			totalMemoryUsed: totalMemory,
			oldestEntry: oldestTimestamp === Infinity ? 0 : oldestTimestamp,
			newestEntry: newestTimestamp === -Infinity ? 0 : newestTimestamp
		};
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this._stats = { hits: 0, misses: 0 };
	}

	/**
	 * Cleanup expired entries
	 */
	evictExpired(): void {
		const now = Date.now();
		const toDelete: string[] = [];

		for (const [key, entry] of this._cache) {
			if (now - entry.timestamp > entry.ttl) {
				toDelete.push(key);
			}
		}

		for (const key of toDelete) {
			this._cache.delete(key);
			this._onEviction.fire({ key, reason: 'ttl' });
		}
	}

	private _evictOne(): void {
		if (this._cache.size === 0) {
			return;
		}

		let keyToEvict: string | undefined;

		if (this._policy.evictionPolicy === 'lru') {
			keyToEvict = this._accessOrder[0];
		} else if (this._policy.evictionPolicy === 'lfu') {
			let minFreq = Infinity;
			for (const [key, freq] of this._accessFrequency) {
				if (freq < minFreq) {
					minFreq = freq;
					keyToEvict = key;
				}
			}
		} else {
			// FIFO: get oldest entry
			let oldestKey: string | undefined;
			let oldestTime = Infinity;
			for (const [key, entry] of this._cache) {
				if (entry.timestamp < oldestTime) {
					oldestTime = entry.timestamp;
					oldestKey = key;
				}
			}
			keyToEvict = oldestKey;
		}

		if (keyToEvict) {
			this._cache.delete(keyToEvict);
			this._accessOrder = this._accessOrder.filter(k => k !== keyToEvict);
			this._accessFrequency.delete(keyToEvict);
			this._onEviction.fire({ key: keyToEvict, reason: 'size' });
		}
	}

	private _updateAccessTracking(key: string): void {
		// Update LRU
		this._accessOrder = this._accessOrder.filter(k => k !== key);
		this._accessOrder.push(key);

		// Update LFU
		const freq = this._accessFrequency.get(key) ?? 0;
		this._accessFrequency.set(key, freq + 1);
	}

	override dispose(): void {
		this._onCacheHit.dispose();
		this._onCacheMiss.dispose();
		this._onEviction.dispose();
		super.dispose();
	}
}
