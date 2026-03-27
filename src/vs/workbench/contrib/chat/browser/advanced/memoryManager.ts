/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';

export interface IMemoryEntry {
	id: string;
	key: string;
	value: unknown;
	timestamp: number;
	ttl?: number;
	tags: string[];
}

export interface IMemorySnapshot {
	entries: IMemoryEntry[];
	size: number;
	timestamp: number;
}

/**
 * Memory manager for storing working context and history
 */
export class MemoryManager extends Disposable {
	private _memory: Map<string, IMemoryEntry> = new Map();
	private _maxSize: number = 10000;
	private _cleanupInterval: ReturnType<typeof setInterval> | undefined;

	constructor() {
		super();
		this._startCleanup();
	}

	override dispose(): void {
		this._stopCleanup();
		super.dispose();
	}

	/**
	 * Store a value
	 */
	set(key: string, value: unknown, ttl?: number, tags: string[] = []): string {
		const id = `${key}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

		const entry: IMemoryEntry = {
			id,
			key,
			value,
			timestamp: Date.now(),
			ttl,
			tags,
		};

		this._memory.set(id, entry);

		// Cleanup if exceeding max size
		if (this._memory.size > this._maxSize) {
			this._evictOldest();
		}

		return id;
	}

	/**
	 * Get a value
	 */
	get(key: string): unknown {
		for (const entry of this._memory.values()) {
			if (entry.key === key) {
				if (this._isExpired(entry)) {
					this._memory.delete(entry.id);
					continue;
				}
				return entry.value;
			}
		}
		return undefined;
	}

	/**
	 * Get all values for a key
	 */
	getAll(key: string): unknown[] {
		const values: unknown[] = [];
		const toDelete: string[] = [];

		for (const entry of this._memory.values()) {
			if (entry.key === key) {
				if (this._isExpired(entry)) {
					toDelete.push(entry.id);
				} else {
					values.push(entry.value);
				}
			}
		}

		toDelete.forEach(id => this._memory.delete(id));
		return values;
	}

	/**
	 * Get value by ID
	 */
	getById(id: string): unknown {
		const entry = this._memory.get(id);
		if (!entry) {
			return undefined;
		}

		if (this._isExpired(entry)) {
			this._memory.delete(id);
			return undefined;
		}

		return entry.value;
	}

	/**
	 * Delete a value
	 */
	delete(key: string): number {
		let count = 0;
		const toDelete: string[] = [];

		for (const entry of this._memory.values()) {
			if (entry.key === key) {
				toDelete.push(entry.id);
				count++;
			}
		}

		toDelete.forEach(id => this._memory.delete(id));
		return count;
	}

	/**
	 * Clear all memory
	 */
	clear(): void {
		this._memory.clear();
	}

	/**
	 * Get by tags
	 */
	getByTags(tags: string[]): unknown[] {
		const values: unknown[] = [];
		const toDelete: string[] = [];

		for (const entry of this._memory.values()) {
			if (tags.some(tag => entry.tags.includes(tag))) {
				if (this._isExpired(entry)) {
					toDelete.push(entry.id);
				} else {
					values.push(entry.value);
				}
			}
		}

		toDelete.forEach(id => this._memory.delete(id));
		return values;
	}

	/**
	 * Get memory statistics
	 */
	getStats(): { size: number; entries: number; oldestEntry: number | undefined } {
		let oldestEntry: number | undefined;

		for (const entry of this._memory.values()) {
			if (oldestEntry === undefined || entry.timestamp < oldestEntry) {
				oldestEntry = entry.timestamp;
			}
		}

		return {
			size: this._memory.size,
			entries: this._memory.size,
			oldestEntry,
		};
	}

	/**
	 * Export memory snapshot
	 */
	export(): IMemorySnapshot {
		return {
			entries: Array.from(this._memory.values()),
			size: this._memory.size,
			timestamp: Date.now(),
		};
	}

	/**
	 * Import memory snapshot
	 */
	import(snapshot: IMemorySnapshot): void {
		this._memory.clear();
		for (const entry of snapshot.entries) {
			this._memory.set(entry.id, entry);
		}
	}

	private _isExpired(entry: IMemoryEntry): boolean {
		if (!entry.ttl) {
			return false;
		}
		return Date.now() - entry.timestamp > entry.ttl;
	}

	private _evictOldest(): void {
		let oldestId: string | undefined;
		let oldestTime = Date.now();

		for (const [id, entry] of this._memory.entries()) {
			if (entry.timestamp < oldestTime) {
				oldestTime = entry.timestamp;
				oldestId = id;
			}
		}

		if (oldestId) {
			this._memory.delete(oldestId);
		}
	}

	private _startCleanup(): void {
		this._cleanupInterval = globalThis.setInterval(() => {
			const toDelete: string[] = [];

			for (const [id, entry] of this._memory.entries()) {
				if (this._isExpired(entry)) {
					toDelete.push(id);
				}
			}

			toDelete.forEach(id => this._memory.delete(id));
		}, 60000); // Cleanup every minute
	}

	private _stopCleanup(): void {
		if (this._cleanupInterval) {
			globalThis.clearInterval(this._cleanupInterval);
			this._cleanupInterval = undefined;
		}
	}
}

/**
 * History manager for conversation and action history
 */
export class HistoryManager extends Disposable {
	private _history: Array<{
		id: string;
		type: string;
		data: unknown;
		timestamp: number;
	}> = [];
	private _maxHistorySize: number = 1000;

	constructor() {
		super();
	}

	/**
	 * Add to history
	 */
	add(type: string, data: unknown): string {
		const id = Math.random().toString(36).substring(2, 15);
		const entry = {
			id,
			type,
			data,
			timestamp: Date.now(),
		};

		this._history.push(entry);

		// Keep history size limited
		if (this._history.length > this._maxHistorySize) {
			this._history.shift();
		}

		return id;
	}

	/**
	 * Get history by type
	 */
	getByType(type: string): unknown[] {
		return this._history
			.filter(entry => entry.type === type)
			.map(entry => entry.data);
	}

	/**
	 * Get all history
	 */
	getAll(): unknown[] {
		return this._history.map(entry => {
			if (typeof entry.data === 'object' && entry.data !== null) {
				return {
					...(entry.data as Record<string, unknown>),
					_timestamp: entry.timestamp,
					_type: entry.type,
				};
			}
			return {
				data: entry.data,
				_timestamp: entry.timestamp,
				_type: entry.type,
			};
		});
	}

	/**
	 * Get recent history
	 */
	getRecent(count: number): unknown[] {
		return this._history
			.slice(-count)
			.reverse()
			.map(entry => entry.data);
	}

	/**
	 * Clear history
	 */
	clear(): void {
		this._history = [];
	}

	/**
	 * Export history
	 */
	export(): string {
		return JSON.stringify(this._history, null, 2);
	}

	/**
	 * Import history
	 */
	import(json: string): void {
		try {
			this._history = JSON.parse(json);
		} catch (error) {
			console.error('Failed to import history', error);
		}
	}
}
