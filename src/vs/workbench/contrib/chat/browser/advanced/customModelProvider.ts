/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';

export interface IModelProvider {
	readonly id: string;
	readonly name: string;
	readonly type: 'cloud' | 'local' | 'private' | 'api';
	readonly capabilities: string[];
	readonly costPerToken?: number;
	readonly maxTokens: number;
	isAvailable(): boolean | Promise<boolean>;
	invoke(prompt: string, options?: IInvokeOptions, token?: CancellationToken): Promise<string>;
	validate(): Promise<boolean>;
}

export interface IInvokeOptions {
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	stopSequences?: string[];
	metadata?: Record<string, unknown>;
}

export interface IModelRegistry {
	readonly [modelId: string]: IModelProvider;
}

export interface IModelStats {
	modelId: string;
	totalInvocations: number;
	successCount: number;
	errorCount: number;
	avgLatencyMs: number;
	totalTokensUsed: number;
	totalCost: number;
}

/**
 * Custom Model Provider System - Support for custom/local/private models
 *
 * Features:
 * - Register custom model providers
 * - Support multiple model types (cloud, local, private, API)
 * - Track usage and costs
 * - Model validation and health checks
 * - Fallback strategies
 */
export class CustomModelProviderSystem extends Disposable {
	private _providers = new Map<string, IModelProvider>();
	private _invocationStats = new Map<string, IModelStats>();
	private _onProviderRegistered = new Emitter<IModelProvider>();
	private _onProviderRemoved = new Emitter<string>();
	private _onModelFailed = new Emitter<{ modelId: string; error: unknown }>();

	readonly onProviderRegistered: Event<IModelProvider> = this._onProviderRegistered.event;
	readonly onProviderRemoved: Event<string> = this._onProviderRemoved.event;
	readonly onModelFailed: Event<{ modelId: string; error: unknown }> = this._onModelFailed.event;

	constructor() {
		super();
		this._register(this._onProviderRegistered);
		this._register(this._onProviderRemoved);
		this._register(this._onModelFailed);
	}

	/**
	 * Register a custom model provider
	 */
	async registerProvider(provider: IModelProvider): Promise<void> {
		// Validate provider before registration
		const isValid = await provider.validate();
		if (!isValid) {
			throw new Error(`Model provider ${provider.id} failed validation`);
		}

		this._providers.set(provider.id, provider);
		this._initializeStats(provider.id);
		this._onProviderRegistered.fire(provider);
	}

	/**
	 * Unregister a model provider
	 */
	unregisterProvider(modelId: string): void {
		this._providers.delete(modelId);
		this._onProviderRemoved.fire(modelId);
	}

	/**
	 * Get a specific model provider
	 */
	getProvider(modelId: string): IModelProvider | undefined {
		return this._providers.get(modelId);
	}

	/**
	 * Get all registered providers
	 */
	getAllProviders(): IModelProvider[] {
		return Array.from(this._providers.values());
	}

	/**
	 * Get providers by type
	 */
	getProvidersByType(type: 'cloud' | 'local' | 'private' | 'api'): IModelProvider[] {
		return Array.from(this._providers.values()).filter(p => p.type === type);
	}

	/**
	 * Invoke a model
	 */
	async invokeModel(modelId: string, prompt: string, options?: IInvokeOptions, token?: CancellationToken): Promise<string> {
		const provider = this._providers.get(modelId);
		if (!provider) {
			throw new Error(`Model ${modelId} not found`);
		}

		const stats = this._invocationStats.get(modelId);
		if (!stats) {
			throw new Error(`Statistics not initialized for model ${modelId}`);
		}

		const available = await provider.isAvailable();
		if (!available) {
			this._onModelFailed.fire({ modelId, error: new Error('Model not available') });
			throw new Error(`Model ${modelId} is not available`);
		}

		try {
			const startTime = Date.now();
			const result = await provider.invoke(prompt, options, token);
			const latencyMs = Date.now() - startTime;

			// Update stats
			stats.totalInvocations++;
			stats.successCount++;
			stats.avgLatencyMs = (stats.avgLatencyMs * (stats.totalInvocations - 1) + latencyMs) / stats.totalInvocations;

			// Estimate tokens (rough: 4 chars = 1 token)
			const estimatedTokens = Math.ceil((prompt.length + result.length) / 4);
			stats.totalTokensUsed += estimatedTokens;

			if (provider.costPerToken) {
				stats.totalCost += estimatedTokens * provider.costPerToken;
			}

			return result;
		} catch (error) {
			stats.totalInvocations++;
			stats.errorCount++;
			this._onModelFailed.fire({ modelId, error });
			throw error;
		}
	}

	/**
	 * Find best available model for a query
	 */
	async findBestModel(query: string, preference?: 'fast' | 'cheap' | 'quality' | 'balanced'): Promise<string> {
		const available: { id: string; provider: IModelProvider }[] = [];

		for (const [modelId, provider] of this._providers) {
			const isAvailable = await provider.isAvailable();
			if (isAvailable) {
				available.push({ id: modelId, provider });
			}
		}

		if (available.length === 0) {
			throw new Error('No models available');
		}

		if (available.length === 1) {
			return available[0].id;
		}

		// Score based on preference
		let bestId = available[0].id;
		let bestScore = -Infinity;

		for (const { id, provider } of available) {
			const stats = this._invocationStats.get(id);
			if (!stats) {
				continue;
			}

			let score = 0;

			if (preference === 'fast') {
				score = -stats.avgLatencyMs;
			} else if (preference === 'cheap') {
				score = -stats.totalCost;
			} else if (preference === 'quality') {
				score = stats.successCount / Math.max(stats.totalInvocations, 1);
			} else {
				// Balanced: combination of all factors
				const successRate = stats.successCount / Math.max(stats.totalInvocations, 1);
				const costPenalty = (provider.costPerToken || 0) * 100;
				score = successRate - (stats.avgLatencyMs / 1000) - costPenalty;
			}

			if (score > bestScore) {
				bestScore = score;
				bestId = id;
			}
		}

		return bestId;
	}

	/**
	 * Get model statistics
	 */
	getStats(modelId?: string): IModelStats | IModelStats[] {
		if (modelId) {
			const stats = this._invocationStats.get(modelId);
			return stats || this._createEmptyStats(modelId);
		}

		return Array.from(this._invocationStats.values());
	}

	/**
	 * Get cost estimate for query
	 */
	estimateCost(modelId: string, prompt: string): number {
		const provider = this._providers.get(modelId);
		if (!provider || !provider.costPerToken) {
			return 0;
		}

		const estimatedTokens = Math.ceil(prompt.length / 4);
		return estimatedTokens * provider.costPerToken;
	}

	/**
	 * Batch invoke models (for comparison)
	 */
	async batchInvoke(modelIds: string[], prompt: string, options?: IInvokeOptions, token?: CancellationToken): Promise<Array<{ modelId: string; result: string; error?: unknown }>> {
		const results = await Promise.allSettled(
			modelIds.map(async (modelId) => ({
				modelId,
				result: await this.invokeModel(modelId, prompt, options, token)
			}))
		);

		return results.map((result, index) => {
			if (result.status === 'fulfilled') {
				return result.value;
			}
			return {
				modelId: modelIds[index],
				result: '',
				error: result.reason
			};
		});
	}

	/**
	 * Health check all models
	 */
	async healthCheck(): Promise<Record<string, boolean>> {
		const results: Record<string, boolean> = {};

		for (const [modelId, provider] of this._providers) {
			try {
				results[modelId] = await provider.validate();
			} catch {
				results[modelId] = false;
			}
		}

		return results;
	}

	/**
	 * Reset statistics for a model
	 */
	resetStats(modelId: string): void {
		this._initializeStats(modelId);
	}

	/**
	 * Clear all statistics
	 */
	clearAllStats(): void {
		for (const modelId of this._providers.keys()) {
			this._initializeStats(modelId);
		}
	}

	private _initializeStats(modelId: string): void {
		this._invocationStats.set(modelId, this._createEmptyStats(modelId));
	}

	private _createEmptyStats(modelId: string): IModelStats {
		return {
			modelId,
			totalInvocations: 0,
			successCount: 0,
			errorCount: 0,
			avgLatencyMs: 0,
			totalTokensUsed: 0,
			totalCost: 0
		};
	}

	override dispose(): void {
		this._onProviderRegistered.dispose();
		this._onProviderRemoved.dispose();
		this._onModelFailed.dispose();
		super.dispose();
	}
}

/**
 * Built-in local model provider for Ollama
 */
export class OllamaModelProvider implements IModelProvider {
	readonly id = 'ollama';
	readonly name = 'Ollama Local';
	readonly type = 'local' as const;
	readonly capabilities = ['code-completion', 'code-review', 'documentation', 'testing'];
	readonly maxTokens = 4096;
	readonly costPerToken = 0; // Local, no cost

	private _baseUrl: string;
	private _modelName: string;

	constructor(baseUrl: string = 'http://localhost:11434', modelName: string = 'mistral') {
		this._baseUrl = baseUrl;
		this._modelName = modelName;
	}

	async isAvailable(): Promise<boolean> {
		try {
			const response = await fetch(`${this._baseUrl}/api/tags`);
			return response.ok;
		} catch {
			return false;
		}
	}

	async invoke(prompt: string, options?: IInvokeOptions, token?: CancellationToken): Promise<string> {
		const response = await fetch(`${this._baseUrl}/api/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: this._modelName,
				prompt,
				stream: false,
				options: {
					temperature: options?.temperature ?? 0.7,
					top_p: options?.topP ?? 0.9,
					num_predict: options?.maxTokens ?? this.maxTokens
				}
			})
		});

		if (!response.ok) {
			throw new Error(`Ollama error: ${response.statusText}`);
		}

		const data = await response.json() as { response: string };
		return data.response;
	}

	async validate(): Promise<boolean> {
		try {
			const response = await fetch(`${this._baseUrl}/api/tags`);
			if (!response.ok) {
				return false;
			}

			const data = await response.json() as { models?: Array<{ name: string }> };
			return data.models?.some(m => m.name === this._modelName) ?? false;
		} catch {
			return false;
		}
	}
}
