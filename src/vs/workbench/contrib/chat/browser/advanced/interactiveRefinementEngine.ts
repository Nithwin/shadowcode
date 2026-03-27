/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';

export interface IRefinementInput {
	originalQuery: string;
	refinementType: 'clarify' | 'expand' | 'focus' | 'alternative' | 'simplify';
	userFeedback?: string;
	context?: Record<string, unknown>;
}

export interface IRefinementSuggestion {
	id: string;
	originalQuery: string;
	refinedQuery: string;
	refinementType: string;
	confidence: number;
	rationale: string;
	expectedImprovement: number; // 0-1
}

export interface IRefinementResult {
	original: { query: string; response: string };
	refined: { query: string; response: string };
	improvement: number; // -1 to 1
	refinementChain: string[];
}

/**
 * Interactive Refinement Engine - Help users iteratively refine queries
 *
 * Supports:
 * - Query clarification
 * - Scope expansion/reduction
 * - Alternative phrasings
 * - Suggestion-based refinement
 * - Multi-step refinement chains
 */
export class InteractiveRefinementEngine extends Disposable {
	private _refinementHistory: IRefinementResult[] = [];
	private _suggestionsCache = new Map<string, IRefinementSuggestion[]>();
	private _onRefinementSuggested = new Emitter<IRefinementSuggestion[]>();
	private _onRefinementCompleted = new Emitter<IRefinementResult>();

	readonly onRefinementSuggested: Event<IRefinementSuggestion[]> = this._onRefinementSuggested.event;
	readonly onRefinementCompleted: Event<IRefinementResult> = this._onRefinementCompleted.event;

	constructor() {
		super();
		this._register(this._onRefinementSuggested);
		this._register(this._onRefinementCompleted);
	}

	/**
	 * Generate refinement suggestions for a query
	 */
	async generateSuggestions(query: string, token?: CancellationToken): Promise<IRefinementSuggestion[]> {
		// Check cache first
		if (this._suggestionsCache.has(query)) {
			return this._suggestionsCache.get(query) ?? [];
		}

		const suggestions: IRefinementSuggestion[] = [];

		// Clarification suggestion
		suggestions.push({
			id: 'clarify-1',
			originalQuery: query,
			refinedQuery: this._clarifySuggestion(query),
			refinementType: 'clarify',
			confidence: 0.75,
			rationale: 'Be more specific about what you need',
			expectedImprovement: 0.2
		});

		// Expansion suggestion
		suggestions.push({
			id: 'expand-1',
			originalQuery: query,
			refinedQuery: this._expandSuggestion(query),
			refinementType: 'expand',
			confidence: 0.65,
			rationale: 'Provide more context for better assistance',
			expectedImprovement: 0.15
		});

		// Focus suggestion
		suggestions.push({
			id: 'focus-1',
			originalQuery: query,
			refinedQuery: this._focusSuggestion(query),
			refinementType: 'focus',
			confidence: 0.8,
			rationale: 'Narrow down to specifics for targeted help',
			expectedImprovement: 0.25
		});

		// Alternative suggestion
		suggestions.push({
			id: 'alt-1',
			originalQuery: query,
			refinedQuery: this._alternativeSuggestion(query),
			refinementType: 'alternative',
			confidence: 0.6,
			rationale: 'Try a different approach',
			expectedImprovement: 0.1
		});

		// Cache and emit
		this._suggestionsCache.set(query, suggestions);
		this._onRefinementSuggested.fire(suggestions);

		return suggestions;
	}

	/**
	 * Apply a refinement suggestion
	 */
	applySuggestion(suggestion: IRefinementSuggestion): void {
		// Track that this suggestion was applied
		// In a real system, this would trigger a new response
	}

	/**
	 * Manually refine a query
	 */
	async refineQuery(input: IRefinementInput, currentResponse: string, processor: (query: string, token?: CancellationToken) => Promise<string>, token?: CancellationToken): Promise<IRefinementResult> {
		const refinedQuery = this._performRefinement(input);

		// Get new response with refined query
		const newResponse = await processor(refinedQuery, token);

		// Calculate improvement
		const improvement = this._calculateImprovement(input.originalQuery, refinedQuery, currentResponse, newResponse);

		const result: IRefinementResult = {
			original: { query: input.originalQuery, response: currentResponse },
			refined: { query: refinedQuery, response: newResponse },
			improvement,
			refinementChain: [input.originalQuery, refinedQuery]
		};

		this._refinementHistory.push(result);
		this._onRefinementCompleted.fire(result);

		return result;
	}

	/**
	 * Multi-step refinement chain
	 */
	async refineChain(initialQuery: string, refinementSteps: IRefinementInput[], processor: (query: string, token?: CancellationToken) => Promise<string>, token?: CancellationToken): Promise<IRefinementResult> {
		let currentQuery = initialQuery;
		let currentResponse = await processor(currentQuery, token);
		const chain: string[] = [initialQuery];

		for (const step of refinementSteps) {
			if (token?.isCancellationRequested) {
				break;
			}

			step.originalQuery = currentQuery;
			const refined = await this.refineQuery(step, currentResponse, processor, token);
			currentQuery = refined.refined.query;
			currentResponse = refined.refined.response;
			chain.push(currentQuery);
		}

		const finalResult: IRefinementResult = {
			original: { query: initialQuery, response: await processor(initialQuery, token) },
			refined: { query: currentQuery, response: currentResponse },
			improvement: this._calculateImprovement(initialQuery, currentQuery, '', currentResponse),
			refinementChain: chain
		};

		return finalResult;
	}

	/**
	 * Get refinement history
	 */
	getHistory(limit: number = 20): IRefinementResult[] {
		return this._refinementHistory.slice(-limit);
	}

	/**
	 * Get refinement statistics
	 */
	getStats(): { totalRefinements: number; averageImprovement: number; mostCommonType: string } {
		const total = this._refinementHistory.length;

		if (total === 0) {
			return { totalRefinements: 0, averageImprovement: 0, mostCommonType: 'none' };
		}

		const avgImprovement = this._refinementHistory.reduce((sum, r) => sum + r.improvement, 0) / total;

		// Find most common refinement type
		const typeCount: Record<string, number> = {};
		for (const result of this._refinementHistory) {
			const type = result.refinementChain[result.refinementChain.length - 1] !== result.original.query ? 'applied' : 'no-change';
			typeCount[type] = (typeCount[type] ?? 0) + 1;
		}

		const mostCommonType = Object.entries(typeCount).sort(([_, a], [__, b]) => b - a)[0]?.[0] ?? 'unknown';

		return { totalRefinements: total, averageImprovement: avgImprovement, mostCommonType };
	}

	/**
	 * Clear cache and history
	 */
	clear(): void {
		this._suggestionsCache.clear();
		this._refinementHistory = [];
	}

	/**
	 * Get next refinement suggestion based on history
	 */
	async getSmartNextStep(lastQuery: string, lastResponse: string, token?: CancellationToken): Promise<IRefinementSuggestion | undefined> {
		const suggestions = await this.generateSuggestions(lastQuery, token);

		// Filter and score based on history
		for (const suggestion of suggestions) {
			// Prefer suggestions that haven't been tried recently
			const recentlySuggested = this._refinementHistory.some(
				r => r.refined.query.includes(suggestion.refinedQuery) && Date.now() - 300000 < Date.now() // 5 min window
			);

			if (!recentlySuggested) {
				return suggestion;
			}
		}

		return suggestions[0];
	}

	private _performRefinement(input: IRefinementInput): string {
		const { originalQuery, refinementType, userFeedback } = input;

		if (userFeedback) {
			return `${originalQuery}. Note: ${userFeedback}`;
		}

		switch (refinementType) {
			case 'clarify':
				return this._clarifySuggestion(originalQuery);
			case 'expand':
				return this._expandSuggestion(originalQuery);
			case 'focus':
				return this._focusSuggestion(originalQuery);
			case 'alternative':
				return this._alternativeSuggestion(originalQuery);
			case 'simplify':
				return this._simplifySuggestion(originalQuery);
			default:
				return originalQuery;
		}
	}

	private _clarifySuggestion(query: string): string {
		return `${query}. Please provide specific examples and constraints.`;
	}

	private _expandSuggestion(query: string): string {
		return `${query}. Also consider edge cases, dependencies, and related concerns.`;
	}

	private _focusSuggestion(query: string): string {
		const parts = query.split(' ');
		if (parts.length > 4) {
			return parts.slice(0, 4).join(' ');
		}
		return `Focus on: ${query}`;
	}

	private _alternativeSuggestion(query: string): string {
		// Simple reordering/rephrasing
		const words = query.split(' ');
		if (words.length > 2) {
			const keyWords = words.filter(w => w.length > 4);
			if (keyWords.length > 0) {
				return `How to ${keyWords[0]} by ${words.join(' ')}?`;
			}
		}
		return `What is the best way to ${query}?`;
	}

	private _simplifySuggestion(query: string): string {
		// Remove complex sentences, simplify
		return query.split('.')[0].trim(); // Just the first sentence
	}

	private _calculateImprovement(originalQuery: string, refinedQuery: string, originalResponse: string, refinedResponse: string): number {
		// Simplified improvement calculation
		if (originalResponse === refinedResponse) {
			return 0;
		}

		const queryChange = refinedQuery.length - originalQuery.length;
		const responseImprovement = refinedResponse.length > originalResponse.length ? 0.5 : -0.2;

		const score = (queryChange / Math.max(originalQuery.length, 10)) * 0.3 + responseImprovement * 0.7;
		return Math.max(-1, Math.min(1, score));
	}

	override dispose(): void {
		this._onRefinementSuggested.dispose();
		this._onRefinementCompleted.dispose();
		super.dispose();
	}
}
