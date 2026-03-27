/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../base/common/event.js';

export interface IBatchItem<TInput = unknown, TOutput = unknown> {
	id: string;
	input: TInput;
	priority?: number; // higher = process first
	timeout?: number;
	processor?: (input: TInput, token: CancellationToken) => Promise<TOutput>;
}

export interface IBatchResult<TOutput = unknown> {
	batchId: string;
	itemId: string;
	success: boolean;
	output?: TOutput;
	error?: unknown;
	processingTime: number;
	retries: number;
}

export interface IBatchStats {
	totalItems: number;
	successCount: number;
	failureCount: number;
	skippedCount: number;
	totalProcessingTime: number;
	averageItemTime: number;
	parallelismLevel: number;
}

/**
 * Batch Processor - Process multiple queries efficiently
 *
 * Features:
 * - Parallel execution with configurable concurrency
 * - Priority-based processing
 * - Automatic retry with backoff
 * - Timeout handling
 * - Progress tracking
 * - Batch grouping and aggregation
 */
export class BatchProcessor<TInput = unknown, TOutput = unknown> extends Disposable {
	private _queue: IBatchItem<TInput, TOutput>[] = [];
	private _activeCount = 0;
	private _results = new Map<string, IBatchResult<TOutput>>();
	private _batchId: string;
	private _maxConcurrency: number;
	private _maxRetries: number;
	private _onBatchStart = new Emitter<{ batchId: string; itemCount: number }>();
	private _onItemProcessed = new Emitter<IBatchResult<TOutput>>();
	private _onBatchComplete = new Emitter<{ batchId: string; stats: IBatchStats }>();
	private _onError = new Emitter<{ itemId: string; error: unknown }>();

	readonly onBatchStart: Event<{ batchId: string; itemCount: number }> = this._onBatchStart.event;
	readonly onItemProcessed: Event<IBatchResult<TOutput>> = this._onItemProcessed.event;
	readonly onBatchComplete: Event<{ batchId: string; stats: IBatchStats }> = this._onBatchComplete.event;
	readonly onError: Event<{ itemId: string; error: unknown }> = this._onError.event;

	constructor(maxConcurrency: number = 4, maxRetries: number = 2) {
		super();
		this._register(this._onBatchStart);
		this._register(this._onItemProcessed);
		this._register(this._onBatchComplete);
		this._register(this._onError);

		this._batchId = `batch-${Date.now()}`;
		this._maxConcurrency = maxConcurrency;
		this._maxRetries = maxRetries;
	}

	/**
	 * Add item to batch
	 */
	addItem(item: IBatchItem<TInput, TOutput>): void {
		this._queue.push(item);
		// Sort by priority
		this._queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
	}

	/**
	 * Add multiple items
	 */
	addItems(items: IBatchItem<TInput, TOutput>[]): void {
		this._queue.push(...items);
		this._queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
	}

	/**
	 * Process all items in batch
	 */
	async processBatch(token?: CancellationToken): Promise<IBatchResult<TOutput>[]> {
		this._results.clear();
		const itemCount = this._queue.length;
		this._onBatchStart.fire({ batchId: this._batchId, itemCount });

		const startTime = Date.now();
		const promises: Promise<void>[] = [];

		// Start initial batch of workers
		for (let i = 0; i < Math.min(this._maxConcurrency, this._queue.length); i++) {
			promises.push(this._processNext(token));
		}

		// Wait for all items to complete
		await Promise.all(promises);

		const stats = this._calculateStats(Date.now() - startTime);
		this._onBatchComplete.fire({ batchId: this._batchId, stats });

		return Array.from(this._results.values());
	}

	/**
	 * Get current batch statistics
	 */
	getStats(): IBatchStats {
		const successful = Array.from(this._results.values()).filter(r => r.success).length;
		const failed = Array.from(this._results.values()).filter(r => !r.success).length;
		const skipped = this._queue.length - successful - failed;

		const totalTime = Array.from(this._results.values()).reduce((sum, r) => sum + r.processingTime, 0);

		return {
			totalItems: this._queue.length + this._results.size,
			successCount: successful,
			failureCount: failed,
			skippedCount: skipped,
			totalProcessingTime: totalTime,
			averageItemTime: this._results.size > 0 ? totalTime / this._results.size : 0,
			parallelismLevel: this._activeCount
		};
	}

	/**
	 * Get result for specific item
	 */
	getResult(itemId: string): IBatchResult<TOutput> | undefined {
		return this._results.get(itemId);
	}

	/**
	 * Get all results
	 */
	getAllResults(): IBatchResult<TOutput>[] {
		return Array.from(this._results.values());
	}

	/**
	 * Clear batch
	 */
	clear(): void {
		this._queue = [];
		this._results.clear();
		this._activeCount = 0;
	}

	/**
	 * Get queue size
	 */
	getQueueSize(): number {
		return this._queue.length;
	}

	private async _processNext(token?: CancellationToken): Promise<void> {
		while (this._queue.length > 0 && !token?.isCancellationRequested) {
			const item = this._queue.shift();
			if (!item) {
				break;
			}

			this._activeCount++;
			await this._processItem(item, token);
			this._activeCount--;

			// Continue processing next item if available
			if (this._queue.length > 0) {
				await this._processNext(token);
			}
		}
	}

	private async _processItem(item: IBatchItem<TInput, TOutput>, token?: CancellationToken, attempt: number = 0): Promise<void> {
		const startTime = Date.now();
		const timeout = item.timeout ?? 30000;

		try {
			if (!item.processor) {
				throw new Error('No processor function provided');
			}

			// Create timeout promise
			const timeoutPromise = new Promise<TOutput>((_, reject) => {
				setTimeout(() => reject(new Error(`Processing timeout after ${timeout}ms`)), timeout);
			});

			// Race between processing and timeout
			const result = await Promise.race([
				item.processor(item.input, token ?? CancellationToken.None),
				timeoutPromise
			]);

			const processingTime = Date.now() - startTime;

			this._results.set(item.id, {
				batchId: this._batchId,
				itemId: item.id,
				success: true,
				output: result,
				processingTime,
				retries: attempt
			});

			this._onItemProcessed.fire(this._results.get(item.id)!);
		} catch (error) {
			const processingTime = Date.now() - startTime;

			if (attempt < this._maxRetries) {
				// Retry with exponential backoff
				await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
				await this._processItem(item, token, attempt + 1);
			} else {
				this._results.set(item.id, {
					batchId: this._batchId,
					itemId: item.id,
					success: false,
					error,
					processingTime,
					retries: attempt
				});

				this._onItemProcessed.fire(this._results.get(item.id)!);
				this._onError.fire({ itemId: item.id, error });
			}
		}
	}

	private _calculateStats(totalTime: number): IBatchStats {
		const successful = Array.from(this._results.values()).filter(r => r.success).length;
		const failed = Array.from(this._results.values()).filter(r => !r.success).length;

		const totalItemTime = Array.from(this._results.values()).reduce((sum, r) => sum + r.processingTime, 0);

		return {
			totalItems: this._results.size,
			successCount: successful,
			failureCount: failed,
			skippedCount: 0,
			totalProcessingTime: totalTime,
			averageItemTime: this._results.size > 0 ? totalItemTime / this._results.size : 0,
			parallelismLevel: this._maxConcurrency
		};
	}

	override dispose(): void {
		this._onBatchStart.dispose();
		this._onItemProcessed.dispose();
		this._onBatchComplete.dispose();
		this._onError.dispose();
		super.dispose();
	}
}
