/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';

export interface IMetricSample {
	timestamp: number;
	value: number;
	label?: string;
	metadata?: Record<string, unknown>;
}

export interface IPerformanceMetrics {
	operationName: string;
	startTime: number;
	endTime?: number;
	duration?: number;
	memoryBefore?: number;
	memoryAfter?: number;
	memoryDelta?: number;
	samples?: IMetricSample[];
}

export interface IPerformanceReport {
	totalOperations: number;
	totalDuration: number;
	averageLatency: number;
	minLatency: number;
	maxLatency: number;
	p50Latency: number;
	p95Latency: number;
	p99Latency: number;
	throughput: number; // ops/sec
	errorRate: number;
	memoryStats: {
		totalAllocated: number;
		avgAllocation: number;
		peakMemory: number;
	};
	slowOperations: IPerformanceMetrics[];
}

/**
 * Performance Monitor - Track and analyze system performance
 *
 * Features:
 * - Latency tracking
 * - Memory profiling
 * - Throughput measurement
 * - Percentile calculations
 * - Slow query identification
 * - Performance reports
 * - Alert thresholds
 */
export class PerformanceMonitor extends Disposable {
	private _metrics = new Map<string, IPerformanceMetrics[]>();
	private _globalMetrics: IPerformanceMetrics[] = [];
	private _currentOperations = new Map<string, IPerformanceMetrics>();
	private _onPerformanceWarning = new Emitter<{ operation: string; message: string; severity: 'warning' | 'error' }>();
	private _onMetricsUpdated = new Emitter<{ operation: string; metrics: IPerformanceMetrics }>();
	private _slowOperationThreshold: number;
	private _highMemoryThreshold: number;

	readonly onPerformanceWarning: Event<{ operation: string; message: string; severity: 'warning' | 'error' }> = this._onPerformanceWarning.event;
	readonly onMetricsUpdated: Event<{ operation: string; metrics: IPerformanceMetrics }> = this._onMetricsUpdated.event;

	constructor(slowOpThreshold: number = 5000, highMemThreshold: number = 100 * 1024 * 1024) {
		super();
		this._register(this._onPerformanceWarning);
		this._register(this._onMetricsUpdated);

		this._slowOperationThreshold = slowOpThreshold;
		this._highMemoryThreshold = highMemThreshold;
	}

	/**
	 * Start tracking an operation
	 */
	startOperation(operationId: string, operationName: string): void {
		const metric: IPerformanceMetrics = {
			operationName,
			startTime: Date.now(),
			memoryBefore: this._getMemoryUsage(),
			samples: []
		};

		this._currentOperations.set(operationId, metric);
	}

	/**
	 * Record a sample within an operation
	 */
	recordSample(operationId: string, value: number, label?: string): void {
		const metric = this._currentOperations.get(operationId);
		if (!metric || !metric.samples) {
			return;
		}

		metric.samples.push({
			timestamp: Date.now(),
			value,
			label,
			metadata: {}
		});
	}

	/**
	 * End tracking and record metric
	 */
	endOperation(operationId: string): IPerformanceMetrics | undefined {
		const metric = this._currentOperations.get(operationId);
		if (!metric) {
			return undefined;
		}

		metric.endTime = Date.now();
		metric.duration = metric.endTime - metric.startTime;
		metric.memoryAfter = this._getMemoryUsage();
		metric.memoryDelta = metric.memoryAfter - (metric.memoryBefore ?? 0);

		this._currentOperations.delete(operationId);

		// Store in global and operation-specific collections
		this._globalMetrics.push(metric);
		if (!this._metrics.has(metric.operationName)) {
			this._metrics.set(metric.operationName, []);
		}
		this._metrics.get(metric.operationName)!.push(metric);

		// Check for warnings
		this._checkPerformanceWarnings(metric);

		// Emit event
		this._onMetricsUpdated.fire({ operation: metric.operationName, metrics: metric });

		// Keep only last 1000 global metrics to avoid memory growth
		if (this._globalMetrics.length > 1000) {
			this._globalMetrics = this._globalMetrics.slice(-1000);
		}

		return metric;
	}

	/**
	 * Get performance report for an operation
	 */
	getOperationReport(operationName: string): IPerformanceReport | undefined {
		const metrics = this._metrics.get(operationName);
		if (!metrics || metrics.length === 0) {
			return undefined;
		}

		const durations = metrics.filter(m => m.duration !== undefined).map(m => m.duration ?? 0);
		const memoryDeltas = metrics.filter(m => m.memoryDelta !== undefined).map(m => m.memoryDelta ?? 0);

		if (durations.length === 0) {
			return undefined;
		}

		durations.sort((a, b) => a - b);

		const totalDuration = durations.reduce((sum, d) => sum + d, 0);
		const avgLatency = totalDuration / durations.length;

		const slowOps = metrics.filter(m => (m.duration ?? 0) > this._slowOperationThreshold);

		return {
			totalOperations: metrics.length,
			totalDuration,
			averageLatency: avgLatency,
			minLatency: durations[0],
			maxLatency: durations[durations.length - 1],
			p50Latency: durations[Math.floor(durations.length * 0.5)],
			p95Latency: durations[Math.floor(durations.length * 0.95)],
			p99Latency: durations[Math.floor(durations.length * 0.99)],
			throughput: (metrics.length / (totalDuration / 1000)), // ops/sec
			errorRate: 0, // Would need error tracking
			memoryStats: {
				totalAllocated: memoryDeltas.reduce((sum, d) => sum + d, 0),
				avgAllocation: memoryDeltas.length > 0 ? memoryDeltas.reduce((sum, d) => sum + d, 0) / memoryDeltas.length : 0,
				peakMemory: Math.max(...memoryDeltas)
			},
			slowOperations: slowOps
		};
	}

	/**
	 * Get global performance report
	 */
	getGlobalReport(): IPerformanceReport | undefined {
		if (this._globalMetrics.length === 0) {
			return undefined;
		}

		const durations = this._globalMetrics.filter(m => m.duration !== undefined).map(m => m.duration ?? 0);
		const memoryDeltas = this._globalMetrics.filter(m => m.memoryDelta !== undefined).map(m => m.memoryDelta ?? 0);

		if (durations.length === 0) {
			return undefined;
		}

		durations.sort((a, b) => a - b);

		const totalDuration = durations.reduce((sum, d) => sum + d, 0);
		const avgLatency = totalDuration / durations.length;

		const slowOps = this._globalMetrics.filter(m => (m.duration ?? 0) > this._slowOperationThreshold);

		return {
			totalOperations: this._globalMetrics.length,
			totalDuration,
			averageLatency: avgLatency,
			minLatency: durations[0],
			maxLatency: durations[durations.length - 1],
			p50Latency: durations[Math.floor(durations.length * 0.5)],
			p95Latency: durations[Math.floor(durations.length * 0.95)],
			p99Latency: durations[Math.floor(durations.length * 0.99)],
			throughput: (this._globalMetrics.length / (totalDuration / 1000)), // ops/sec
			errorRate: 0,
			memoryStats: {
				totalAllocated: memoryDeltas.reduce((sum, d) => sum + d, 0),
				avgAllocation: memoryDeltas.length > 0 ? memoryDeltas.reduce((sum, d) => sum + d, 0) / memoryDeltas.length : 0,
				peakMemory: Math.max(...memoryDeltas, 0)
			},
			slowOperations: slowOps.slice(0, 10)
		};
	}

	/**
	 * Reset metrics for an operation
	 */
	resetOperation(operationName: string): void {
		this._metrics.delete(operationName);
	}

	/**
	 * Clear all metrics
	 */
	clearAll(): void {
		this._metrics.clear();
		this._globalMetrics = [];
		this._currentOperations.clear();
	}

	/**
	 * Set performance thresholds
	 */
	setThresholds(slowOpThreshold?: number, highMemThreshold?: number): void {
		if (slowOpThreshold !== undefined) {
			this._slowOperationThreshold = slowOpThreshold;
		}
		if (highMemThreshold !== undefined) {
			this._highMemoryThreshold = highMemThreshold;
		}
	}

	/**
	 * Get list of all tracked operations
	 */
	getTrackedOperations(): string[] {
		return Array.from(this._metrics.keys());
	}

	private _checkPerformanceWarnings(metric: IPerformanceMetrics): void {
		if ((metric.duration ?? 0) > this._slowOperationThreshold) {
			this._onPerformanceWarning.fire({
				operation: metric.operationName,
				message: `Operation took ${metric.duration}ms (threshold: ${this._slowOperationThreshold}ms)`,
				severity: 'warning'
			});
		}

		if ((metric.memoryDelta ?? 0) > this._highMemoryThreshold) {
			this._onPerformanceWarning.fire({
				operation: metric.operationName,
				message: `High memory allocation: ${metric.memoryDelta}bytes (threshold: ${this._highMemoryThreshold}bytes)`,
				severity: 'warning'
			});
		}
	}

	private _getMemoryUsage(): number {
		// In browser environment, use performance API if available
		if (typeof globalThis !== 'undefined' && globalThis) {
			const perf = (globalThis as unknown as Record<string, unknown>).performance;
			if (typeof perf === 'object' && perf !== null) {
				const memory = (perf as unknown as Record<string, unknown>).memory;
				if (typeof memory === 'object' && memory !== null && typeof (memory as unknown as Record<string, unknown>).usedJSHeapSize === 'number') {
					return (memory as unknown as Record<string, unknown>).usedJSHeapSize as number;
				}
			}
		}

		// Fallback: return 0 if not available
		return 0;
	}

	override dispose(): void {
		this._onPerformanceWarning.dispose();
		this._onMetricsUpdated.dispose();
		super.dispose();
	}
}
