/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';

export interface IInteractionEvent {
	timestamp: number;
	queryId: string;
	query: string;
	selectedAgent: string;
	responseQuality: number; // 0-1
	userFeedback?: 'positive' | 'negative' | 'neutral';
	refinementCount: number;
	timeToFirstResponse: number;
	documentedCode?: boolean;
	codeGenerated?: boolean;
}

export interface IUserPreference {
	preferredAgents: Map<string, number>; // agentId -> score
	queryPatterns: Map<string, string[]>; // pattern -> preferred_agents
	modelPreferences: Map<string, number>; // modelId -> score
	feedbackTrend: 'improving' | 'stable' | 'declining';
	lastUpdated: number;
}

export interface ILearningStats {
	totalInteractions: number;
	averageQuality: number;
	preferredAgentId: string;
	feedbackRatio: { positive: number; negative: number; neutral: number };
	commonQueryTypes: Array<{ pattern: string; frequency: number }>;
	improvementTrend: number; // -1 to 1
}

/**
 * User Learning Engine - Learns from user interactions to improve recommendations
 *
 * Tracks:
 * - Query patterns and preferred agents
 * - Response quality feedback
 * - User agent preferences
 * - Interaction trends over time
 */
export class UserLearningEngine extends Disposable {
	private _interactions: IInteractionEvent[] = [];
	private _userPreferences: IUserPreference;
	private _queryPatterns = new Map<string, number>();
	private _agentScores = new Map<string, number>();
	private _modelScores = new Map<string, number>();
	private _onPreferencesUpdated = new Emitter<IUserPreference>();

	readonly onPreferencesUpdated: Event<IUserPreference> = this._onPreferencesUpdated.event;

	constructor() {
		super();
		this._register(this._onPreferencesUpdated);

		this._userPreferences = {
			preferredAgents: new Map(),
			queryPatterns: new Map(),
			modelPreferences: new Map(),
			feedbackTrend: 'stable',
			lastUpdated: Date.now()
		};
	}

	/**
	 * Record an interaction
	 */
	recordInteraction(event: IInteractionEvent): void {
		this._interactions.push(event);

		// Update agent scores
		const currentScore = this._agentScores.get(event.selectedAgent) ?? 0;
		const weight = event.responseQuality * event.refinementCount;
		this._agentScores.set(event.selectedAgent, currentScore + weight);

		// Update query pattern
		const pattern = this._extractQueryPattern(event.query);
		const patternCount = this._queryPatterns.get(pattern) ?? 0;
		this._queryPatterns.set(pattern, patternCount + 1);

		// Update feedback trend
		this._updateFeedbackTrend();

		// Persist preferences
		this._updateUserPreferences();
		this._onPreferencesUpdated.fire(this._userPreferences);
	}

	/**
	 * Get recommended agent for query
	 */
	getRecommendedAgent(query: string): string | undefined {
		const pattern = this._extractQueryPattern(query);
		const pattternAgents = this._userPreferences.queryPatterns.get(pattern);

		if (pattternAgents && pattternAgents.length > 0) {
			return pattternAgents[0];
		}

		// Return top agent by score
		if (this._userPreferences.preferredAgents.size > 0) {
			let bestAgent: string | undefined;
			let bestScore = -Infinity;

			for (const [agentId, score] of this._userPreferences.preferredAgents) {
				if (score > bestScore) {
					bestScore = score;
					bestAgent = agentId;
				}
			}

			return bestAgent;
		}

		return undefined;
	}

	/**
	 * Get recommended model for agent
	 */
	getRecommendedModel(agentId: string): string | undefined {
		if (this._userPreferences.modelPreferences.size === 0) {
			return undefined;
		}

		let bestModel: string | undefined;
		let bestScore = -Infinity;

		for (const [modelId, score] of this._userPreferences.modelPreferences) {
			if (score > bestScore) {
				bestScore = score;
				bestModel = modelId;
			}
		}

		return bestModel;
	}

	/**
	 * Get learning statistics
	 */
	getStats(): ILearningStats {
		const totalInteractions = this._interactions.length;

		if (totalInteractions === 0) {
			return {
				totalInteractions: 0,
				averageQuality: 0,
				preferredAgentId: 'unknown',
				feedbackRatio: { positive: 0, negative: 0, neutral: 0 },
				commonQueryTypes: [],
				improvementTrend: 0
			};
		}

		const avgQuality = this._interactions.reduce((sum, i) => sum + i.responseQuality, 0) / totalInteractions;

		const feedback = { positive: 0, negative: 0, neutral: 0 };
		for (const interaction of this._interactions) {
			if (interaction.userFeedback === 'positive') {
				feedback.positive++;
			} else if (interaction.userFeedback === 'negative') {
				feedback.negative++;
			} else {
				feedback.neutral++;
			}
		}

		let preferredAgentId = 'unknown';
		let maxScore = -Infinity;
		for (const [agentId, score] of this._agentScores) {
			if (score > maxScore) {
				maxScore = score;
				preferredAgentId = agentId;
			}
		}

		const commonQueryTypes = Array.from(this._queryPatterns.entries())
			.map(([pattern, frequency]) => ({ pattern, frequency }))
			.sort((a, b) => b.frequency - a.frequency)
			.slice(0, 5);

		// Calculate improvement trend (comparing first 50% to last 50%)
		const midpoint = Math.floor(totalInteractions / 2);
		const firstHalf = this._interactions.slice(0, midpoint);
		const secondHalf = this._interactions.slice(midpoint);

		const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, i) => sum + i.responseQuality, 0) / firstHalf.length : 0;
		const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, i) => sum + i.responseQuality, 0) / secondHalf.length : 0;

		const improvementTrend = (secondHalfAvg - firstHalfAvg) / Math.max(firstHalfAvg, 0.1);

		return {
			totalInteractions,
			averageQuality: avgQuality,
			preferredAgentId,
			feedbackRatio: feedback,
			commonQueryTypes,
			improvementTrend
		};
	}

	/**
	 * Get learning insights
	 */
	getInsights(): string[] {
		const stats = this.getStats();
		const insights: string[] = [];

		if (stats.totalInteractions === 0) {
			insights.push('No interaction history yet. Start asking questions to build preferences.');
			return insights;
		}

		// Insight 1: Preferred agent
		insights.push(`You prefer the ${stats.preferredAgentId} agent (${(stats.averageQuality * 100).toFixed(0)}% quality).`);

		// Insight 2: Feedback trend
		const total = stats.feedbackRatio.positive + stats.feedbackRatio.negative + stats.feedbackRatio.neutral;
		if (total > 0) {
			const positivePercent = (stats.feedbackRatio.positive / total * 100).toFixed(0);
			insights.push(`${positivePercent}% of your feedback has been positive.`);
		}

		// Insight 3: Improvement trend
		if (stats.improvementTrend > 0.1) {
			insights.push('Your responses are improving over time.');
		} else if (stats.improvementTrend < -0.1) {
			insights.push('Consider refining your queries for better results.');
		}

		// Insight 4: Common patterns
		if (stats.commonQueryTypes.length > 0) {
			const topPattern = stats.commonQueryTypes[0];
			insights.push(`Your most common query type: "${topPattern.pattern}" (${topPattern.frequency} times).`);
		}

		return insights;
	}

	/**
	 * Update model preference score
	 */
	recordModelFeedback(modelId: string, quality: number): void {
		const currentScore = this._modelScores.get(modelId) ?? 0;
		this._modelScores.set(modelId, currentScore + quality);
		this._updateUserPreferences();
	}

	/**
	 * Export learning data
	 */
	export(): { interactions: IInteractionEvent[]; preferences: IUserPreference } {
		return {
			interactions: [...this._interactions],
			preferences: this._userPreferences
		};
	}

	/**
	 * Import learning data
	 */
	import(data: { interactions: IInteractionEvent[]; preferences: IUserPreference }): void {
		this._interactions = [...data.interactions];
		this._userPreferences = data.preferences;
		this._rebuildStats();
	}

	/**
	 * Clear all learning data
	 */
	reset(): void {
		this._interactions = [];
		this._queryPatterns.clear();
		this._agentScores.clear();
		this._modelScores.clear();
		this._userPreferences = {
			preferredAgents: new Map(),
			queryPatterns: new Map(),
			modelPreferences: new Map(),
			feedbackTrend: 'stable',
			lastUpdated: Date.now()
		};
	}

	private _extractQueryPattern(query: string): string {
		// Extract key terms from query (simplified)
		const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
		return words.slice(0, 3).join(' ') || 'general';
	}

	private _updateUserPreferences(): void {
		this._userPreferences.preferredAgents.clear();
		for (const [agentId, score] of this._agentScores) {
			this._userPreferences.preferredAgents.set(agentId, score);
		}

		this._userPreferences.modelPreferences.clear();
		for (const [modelId, score] of this._modelScores) {
			this._userPreferences.modelPreferences.set(modelId, score);
		}

		this._userPreferences.lastUpdated = Date.now();

		// Update query patterns
		for (const [pattern, _] of this._queryPatterns) {
			const preferredAgents = this._findPreferredAgentsForPattern(pattern);
			if (preferredAgents.length > 0) {
				this._userPreferences.queryPatterns.set(pattern, preferredAgents);
			}
		}
	}

	private _findPreferredAgentsForPattern(pattern: string): string[] {
		const agentsScores: Array<[string, number]> = [];

		for (const interaction of this._interactions) {
			if (this._extractQueryPattern(interaction.query) === pattern) {
				const idx = agentsScores.findIndex(([id]) => id === interaction.selectedAgent);
				if (idx >= 0) {
					agentsScores[idx][1] += interaction.responseQuality;
				} else {
					agentsScores.push([interaction.selectedAgent, interaction.responseQuality]);
				}
			}
		}

		return agentsScores.sort((a, b) => b[1] - a[1]).map(([id]) => id);
	}

	private _updateFeedbackTrend(): void {
		if (this._interactions.length < 10) {
			this._userPreferences.feedbackTrend = 'stable';
			return;
		}

		const recentFeedback = this._interactions.slice(-10);
		const positiveCount = recentFeedback.filter(i => i.userFeedback === 'positive').length;

		if (positiveCount >= 7) {
			this._userPreferences.feedbackTrend = 'improving';
		} else if (positiveCount <= 3) {
			this._userPreferences.feedbackTrend = 'declining';
		} else {
			this._userPreferences.feedbackTrend = 'stable';
		}
	}

	private _rebuildStats(): void {
		this._queryPatterns.clear();
		this._agentScores.clear();

		for (const interaction of this._interactions) {
			const pattern = this._extractQueryPattern(interaction.query);
			this._queryPatterns.set(pattern, (this._queryPatterns.get(pattern) ?? 0) + 1);

			const score = this._agentScores.get(interaction.selectedAgent) ?? 0;
			this._agentScores.set(interaction.selectedAgent, score + interaction.responseQuality);
		}
	}

	override dispose(): void {
		this._onPreferencesUpdated.dispose();
		super.dispose();
	}
}
