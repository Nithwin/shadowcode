/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';

export enum ModelType {
	FastGeneration = 'fast', // For quick tasks (comments, simple fixes)
	BalancedGeneration = 'balanced', // Default balanced model
	PowerfulAnalysis = 'powerful', // For complex analysis
	Specialist = 'specialist' // Domain-specific models
}

export interface ILanguageModel {
	id: string;
	name: string;
	type: ModelType;
	capabilities: string[];
	contextWindow: number;
	costMultiplier: number; // Relative to baseline model
	bestFor: string[]; // Use cases this model excels at
}

export interface IModelRequest {
	prompt: string;
	context?: Record<string, unknown>;
	maxTokens?: number;
	temperature?: number;
	useStreaming?: boolean;
}

export interface IModelResponse {
	content: string;
	model: string;
	tokensUsed: number;
	finishReason: 'stop' | 'length' | 'error';
}

/**
 * Multi-Model Support System
 *
 * Routes queries to optimal language models based on:
 * - Query complexity
 * - Available context
 * - Cost considerations
 * - Latency requirements
 * - Model specialization
 */
export class MultiModelRouter extends Disposable {
	private _models: Map<string, ILanguageModel> = new Map();
	private _routingRules: Array<{
		pattern: RegExp;
		modelType: ModelType;
		reasoning: string;
	}> = [];

	constructor() {
		super();
		this._initializeModels();
		this._setupRoutingRules();
	}

	private _initializeModels(): void {
		// Fast model - for quick operations
		this._models.set('gpt-4-turbo-fast', {
			id: 'gpt-4-turbo-fast',
			name: 'GPT-4 Turbo Fast',
			type: ModelType.FastGeneration,
			capabilities: ['code-generation', 'comments', 'simple-fixes'],
			contextWindow: 16000,
			costMultiplier: 0.5,
			bestFor: ['generating comments', 'simple code fixes', 'explanations']
		});

		// Balanced model - default choice
		this._models.set('gpt-4-turbo', {
			id: 'gpt-4-turbo',
			name: 'GPT-4 Turbo',
			type: ModelType.BalancedGeneration,
			capabilities: ['code-generation', 'analysis', 'refactoring', 'documentation'],
			contextWindow: 128000,
			costMultiplier: 1.0,
			bestFor: ['general coding tasks', 'refactoring', 'documentation']
		});

		// Powerful analysis model
		this._models.set('gpt-4-turbo-vision', {
			id: 'gpt-4-turbo-vision',
			name: 'GPT-4 Turbo with Vision',
			type: ModelType.PowerfulAnalysis,
			capabilities: ['deep-analysis', 'architecture', 'complex-refactoring', 'pattern-detection'],
			contextWindow: 128000,
			costMultiplier: 2.0,
			bestFor: ['architecture design', 'complex analysis', 'large refactoring']
		});

		// Code specialist
		this._models.set('claude-code', {
			id: 'claude-code',
			name: 'Claude Code Specialist',
			type: ModelType.Specialist,
			capabilities: ['code-generation', 'debugging', 'optimization', 'testing'],
			contextWindow: 200000,
			costMultiplier: 1.5,
			bestFor: ['debugging', 'performance optimization', 'unit tests']
		});

		// Writing specialist
		this._models.set('claude-writing', {
			id: 'claude-writing',
			name: 'Claude Writing Specialist',
			type: ModelType.Specialist,
			capabilities: ['documentation', 'comments', 'api-docs', 'changelog'],
			contextWindow: 100000,
			costMultiplier: 1.2,
			bestFor: ['comprehensive documentation', 'README generation', 'API docs']
		});
	}

	private _setupRoutingRules(): void {
		// Route simple comments to fast model
		this._routingRules.push({
			pattern: /^(add|write)\s+(comment|docstring|doc)/i,
			modelType: ModelType.FastGeneration,
			reasoning: 'Comments are quick operations'
		});

		// Route debugging to specialist
		this._routingRules.push({
			pattern: /^(debug|find|fix|trace|profile)\s+(bug|issue|error|leak|performance)/i,
			modelType: ModelType.Specialist,
			reasoning: 'Debugging requires specialized knowledge'
		});

		// Route architecture to powerful
		this._routingRules.push({
			pattern: /^(design|architect|structure)\s+(system|app|project|microservice)/i,
			modelType: ModelType.PowerfulAnalysis,
			reasoning: 'Architecture needs deep analysis'
		});

		// Route documentation to specialist
		this._routingRules.push({
			pattern: /^(document|generate\s+readme|write\s+api)/i,
			modelType: ModelType.Specialist,
			reasoning: 'Documentation quality is priority'
		});

		// Route complex refactoring to powerful
		this._routingRules.push({
			pattern: /^refactor\s+(large|complex|entire|whole)/i,
			modelType: ModelType.PowerfulAnalysis,
			reasoning: 'Complex refactoring needs careful analysis'
		});
	}

	/**
	 * Route a query to the best model
	 */
	routeQuery(prompt: string, budget?: 'cost' | 'quality' | 'speed'): ILanguageModel {
		// Check explicit routing rules first
		for (const rule of this._routingRules) {
			if (rule.pattern.test(prompt)) {
				const candidates = Array.from(this._models.values())
					.filter(m => m.type === rule.modelType);
				if (candidates.length > 0) {
					return candidates[0];
				}
			}
		}

		// Route based on budget
		if (budget === 'cost') {
			return this._selectByBudget('cost');
		} else if (budget === 'quality') {
			return this._selectByBudget('quality');
		} else if (budget === 'speed') {
			return this._selectByBudget('speed');
		}

		// Default to balanced model
		return this._models.get('gpt-4-turbo')!;
	}

	private _selectByBudget(budget: 'cost' | 'quality' | 'speed'): ILanguageModel {
		const models = Array.from(this._models.values());

		switch (budget) {
			case 'cost':
				return models.reduce((min, m) => m.costMultiplier < min.costMultiplier ? m : min);
			case 'quality':
				return models.reduce((max, m) => m.costMultiplier > max.costMultiplier ? m : max);
			case 'speed':
				return models.filter(m => m.type === ModelType.FastGeneration)[0] || models[0];
		}
	}

	/**
	 * Get all available models
	 */
	getAllModels(): ILanguageModel[] {
		return Array.from(this._models.values());
	}

	/**
	 * Get models by type
	 */
	getModelsByType(type: ModelType): ILanguageModel[] {
		return Array.from(this._models.values()).filter(m => m.type === type);
	}

	/**
	 * Get models for specific use case
	 */
	getModelsFor(useCase: string): ILanguageModel[] {
		return Array.from(this._models.values()).filter(m =>
			m.bestFor.some(uc => uc.includes(useCase))
		);
	}

	/**
	 * Simulate model invocation (placeholder)
	 */
	async invokeModel(model: ILanguageModel, request: IModelRequest, token: CancellationToken = CancellationToken.None): Promise<IModelResponse> {
		// Simulate API call
		return {
			content: `Response from ${model.name} for: ${request.prompt.substring(0, 50)}...`,
			model: model.id,
			tokensUsed: Math.ceil(request.maxTokens ?? 1000 * 0.7),
			finishReason: 'stop'
		};
	}

	/**
	 * Estimate cost for a query
	 */
	estimateCost(model: ILanguageModel, tokenCount: number): number {
		// Base cost: $0.01 per 1000 tokens
		const baseCost = (tokenCount / 1000) * 0.01;
		return baseCost * model.costMultiplier;
	}

	/**
	 * Register a new model
	 */
	registerModel(model: ILanguageModel): void {
		this._models.set(model.id, model);
	}

	/**
	 * Unregister a model
	 */
	unregisterModel(modelId: string): void {
		this._models.delete(modelId);
	}
}
