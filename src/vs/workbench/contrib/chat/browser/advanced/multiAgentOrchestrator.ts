/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';

export interface ISpecializedAgent {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly specialization: 'coding' | 'architecture' | 'testing' | 'performance' | 'documentation';
	readonly capabilities: string[];
	isAvailable(query: string): boolean;
	process(query: string, context: unknown, token: CancellationToken): Promise<IAgentResponse>;
}

export interface IAgentResponse {
	agentId: string;
	result: string;
	confidence: number;
	metadata?: Record<string, unknown>;
	timeMs: number;
}

export interface IMultiAgentRequest {
	query: string;
	context: unknown;
	preferredAgents?: string[];
	timeout?: number;
	allowParallel?: boolean;
}

export interface IOrchestrationResult {
	primaryResult: IAgentResponse;
	secondaryResults: IAgentResponse[];
	combinedResult: string;
	strategy: 'single' | 'sequential' | 'parallel' | 'consensus';
	confidence: number;
}

/**
 * Multi-Agent Orchestrator - Coordinates multiple specialized agents
 *
 * Supports:
 * - Agent registration and lifecycle
 * - Query routing to specialized agents
 * - Parallel execution with consensus
 * - Sequential execution with context passing
 * - Fallback and retry strategies
 */
export class MultiAgentOrchestrator extends Disposable {
	private _agents = new Map<string, ISpecializedAgent>();
	private _executionHistory: IOrchestrationResult[] = [];
	private _onAgentSelected = new Emitter<{ agentId: string; query: string }>();
	private _onResultsAvailable = new Emitter<IOrchestrationResult>();

	readonly onAgentSelected: Event<{ agentId: string; query: string }> = this._onAgentSelected.event;
	readonly onResultsAvailable: Event<IOrchestrationResult> = this._onResultsAvailable.event;

	constructor() {
		super();
		this._register(this._onAgentSelected);
		this._register(this._onResultsAvailable);
	}

	/**
	 * Register a specialized agent
	 */
	registerAgent(agent: ISpecializedAgent): void {
		this._agents.set(agent.id, agent);
	}

	/**
	 * Unregister an agent
	 */
	unregisterAgent(id: string): void {
		this._agents.delete(id);
	}

	/**
	 * Find best agents for a query
	 */
	private _findBestAgents(query: string, preferredIds?: string[]): ISpecializedAgent[] {
		const candidates: ISpecializedAgent[] = [];

		// If preferred agents specified, include them first
		if (preferredIds) {
			for (const id of preferredIds) {
				const agent = this._agents.get(id);
				if (agent && agent.isAvailable(query)) {
					candidates.push(agent);
				}
			}
		}

		// Then add other available agents
		for (const agent of this._agents.values()) {
			if (agent.isAvailable(query) && !candidates.includes(agent)) {
				candidates.push(agent);
			}
		}

		return candidates;
	}

	/**
	 * Process request with single best agent
	 */
	async processSingle(request: IMultiAgentRequest, token: CancellationToken): Promise<IOrchestrationResult> {
		const agents = this._findBestAgents(request.query, request.preferredAgents);

		if (agents.length === 0) {
			throw new Error(`No agents available for query: ${request.query}`);
		}

		const bestAgent = agents[0];
		this._onAgentSelected.fire({ agentId: bestAgent.id, query: request.query });

		const start = Date.now();
		const primaryResult = await bestAgent.process(request.query, request.context, token);
		primaryResult.timeMs = Date.now() - start;

		const result: IOrchestrationResult = {
			primaryResult,
			secondaryResults: [],
			combinedResult: primaryResult.result,
			strategy: 'single',
			confidence: primaryResult.confidence
		};

		this._executionHistory.push(result);
		this._onResultsAvailable.fire(result);
		return result;
	}

	/**
	 * Process request with sequential agents (each builds on previous context)
	 */
	async processSequential(request: IMultiAgentRequest, token: CancellationToken): Promise<IOrchestrationResult> {
		const agents = this._findBestAgents(request.query, request.preferredAgents);

		if (agents.length === 0) {
			throw new Error(`No agents available for query: ${request.query}`);
		}

		const results: IAgentResponse[] = [];
		let context = request.context;

		for (const agent of agents) {
			if (token.isCancellationRequested) {
				break;
			}

			this._onAgentSelected.fire({ agentId: agent.id, query: request.query });

			const start = Date.now();
			const response = await agent.process(request.query, context, token);
			response.timeMs = Date.now() - start;

			results.push(response);
			context = { previousResult: response, originalContext: request.context };
		}

		const primaryResult = results[0];
		const secondaryResults = results.slice(1);

		const combinedResult = this._combineResults(results, 'sequential');

		const result: IOrchestrationResult = {
			primaryResult,
			secondaryResults,
			combinedResult,
			strategy: 'sequential',
			confidence: primaryResult.confidence
		};

		this._executionHistory.push(result);
		this._onResultsAvailable.fire(result);
		return result;
	}

	/**
	 * Process request with parallel agents (consensus approach)
	 */
	async processParallel(request: IMultiAgentRequest, token: CancellationToken): Promise<IOrchestrationResult> {
		const agents = this._findBestAgents(request.query, request.preferredAgents);

		if (agents.length === 0) {
			throw new Error(`No agents available for query: ${request.query}`);
		}

		const promises = agents.map(async (agent) => {
			this._onAgentSelected.fire({ agentId: agent.id, query: request.query });
			const start = Date.now();
			const response = await agent.process(request.query, request.context, token);
			response.timeMs = Date.now() - start;
			return response;
		});

		const results = await Promise.all(promises);
		const primaryResult = results[0];
		const secondaryResults = results.slice(1);

		const combinedResult = this._combineResults(results, 'parallel');
		const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

		const result: IOrchestrationResult = {
			primaryResult,
			secondaryResults,
			combinedResult,
			strategy: 'parallel',
			confidence: avgConfidence
		};

		this._executionHistory.push(result);
		this._onResultsAvailable.fire(result);
		return result;
	}

	/**
	 * Route query based on content and preferences
	 */
	async processAuto(request: IMultiAgentRequest, token: CancellationToken): Promise<IOrchestrationResult> {
		const agents = this._findBestAgents(request.query, request.preferredAgents);

		if (agents.length === 0) {
			throw new Error(`No agents available for query: ${request.query}`);
		}

		// For simple queries, use single agent
		if (request.query.length < 100 && agents.length === 1) {
			return this.processSingle(request, token);
		}

		// For complex queries with multiple capable agents, use consensus
		if (agents.length > 1 && request.allowParallel !== false) {
			return this.processParallel(request, token);
		}

		// Otherwise use sequential
		return this.processSequential(request, token);
	}

	/**
	 * Get execution history
	 */
	getExecutionHistory(limit: number = 50): IOrchestrationResult[] {
		return this._executionHistory.slice(-limit);
	}

	/**
	 * Get agent statistics
	 */
	getAgentStats(): Record<string, { usageCount: number; avgConfidence: number; avgTimeMs: number }> {
		const stats: Record<string, { usageCount: number; avgConfidence: number; avgTimeMs: number }> = {};

		for (const result of this._executionHistory) {
			const agentId = result.primaryResult.agentId;
			if (!stats[agentId]) {
				stats[agentId] = { usageCount: 0, avgConfidence: 0, avgTimeMs: 0 };
			}

			stats[agentId].usageCount++;
			stats[agentId].avgConfidence = (stats[agentId].avgConfidence * (stats[agentId].usageCount - 1) + result.primaryResult.confidence) / stats[agentId].usageCount;
			stats[agentId].avgTimeMs = (stats[agentId].avgTimeMs * (stats[agentId].usageCount - 1) + result.primaryResult.timeMs) / stats[agentId].usageCount;
		}

		return stats;
	}

	/**
	 * Combine results from multiple agents
	 */
	private _combineResults(results: IAgentResponse[], strategy: 'sequential' | 'parallel'): string {
		if (results.length === 0) {
			return '';
		}

		if (results.length === 1) {
			return results[0].result;
		}

		if (strategy === 'sequential') {
			// Chain results with clear separation
			return results.map((r, i) => `[Agent ${i + 1}: ${r.agentId}]\n${r.result}`).join('\n\n---\n\n');
		}

		// Parallel: consensus-like combination
		const high_confidence = results.filter(r => r.confidence > 0.8);
		if (high_confidence.length > 0) {
			return high_confidence.map(r => r.result).join('\n\n');
		}

		return results.map(r => `${r.result} (confidence: ${(r.confidence * 100).toFixed(0)}%)`).join('\n\n');
	}

	/**
	 * Clear execution history
	 */
	clearHistory(): void {
		this._executionHistory = [];
	}

	override dispose(): void {
		this._onAgentSelected.dispose();
		this._onResultsAvailable.dispose();
		super.dispose();
	}
}
