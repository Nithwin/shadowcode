/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { ConversationStateManager, IConversationState } from './conversationStateManager.js';
import { ContextProviderManager, IContextProvider } from './contextProviders.js';
import { StreamingResponseHandler } from './streamingResponseHandler.js';
import { ToolRegistry, ITool } from './toolRegistry.js';
import { PromptTemplateManager } from './promptTemplates.js';
import { MemoryManager, HistoryManager } from './memoryManager.js';
import { CodeAnalyzer } from './codeAnalyzer.js';
import { ContextAwarenessEngine } from './contextAwarenessEngine.js';
import { MultiModelRouter, ModelType } from './multiModelRouter.js';
import { WorkspaceAnalysisEngine } from './workspaceAnalysisEngine.js';
// Phase 3 Systems
import { MultiAgentOrchestrator } from './multiAgentOrchestrator.js';
import { UserLearningEngine, type IInteractionEvent } from './userLearningEngine.js';
import { CustomModelProviderSystem } from './customModelProvider.js';
import { InteractiveRefinementEngine } from './interactiveRefinementEngine.js';
import { KnowledgeGraphBuilder } from './knowledgeGraphBuilder.js';
// Phase 4 Systems
import { QueryCacheManager } from './queryCacheManager.js';
import { ResponseCache } from './responseCache.js';
import { BatchProcessor, type IBatchItem } from './batchProcessor.js';
import { PerformanceMonitor } from './performanceMonitor.js';

export interface IAdvancedChatRequest {
	userMessage: string;
	templateId?: string;
	context?: Record<string, unknown>;
	tools?: string[]; // Tool IDs to use
	includeCodeAnalysis?: boolean;
	streaming?: boolean;
}

export interface IAdvancedChatResponse {
	id: string;
	conversationId: string;
	message: string;
	suggestions?: string[];
	analysis?: unknown;
	toolResults?: unknown[];
}

/**
 * Advanced chat orchestrator combining all intelligent features
 */
export class AdvancedChatOrchestrator extends Disposable {
	private _conversationManager: ConversationStateManager;
	private _contextManager: ContextProviderManager;
	private _streamingHandler: StreamingResponseHandler;
	private _toolRegistry: ToolRegistry;
	private _promptTemplates: PromptTemplateManager;
	private _memory: MemoryManager;
	private _history: HistoryManager;
	private _codeAnalyzer: CodeAnalyzer;
	private _contextAwareness: ContextAwarenessEngine;
	private _modelRouter: MultiModelRouter;
	private _workspaceAnalyzer: WorkspaceAnalysisEngine;
	// Phase 3 Systems
	private _multiAgentOrchestrator: MultiAgentOrchestrator;
	private _userLearning: UserLearningEngine;
	private _customModels: CustomModelProviderSystem;
	private _refinementEngine: InteractiveRefinementEngine;
	private _knowledgeGraph: KnowledgeGraphBuilder;
	// Phase 4 Systems
	private _queryCache: QueryCacheManager<unknown>;
	private _responseCache: ResponseCache;
	private _batchProcessor: BatchProcessor<unknown, unknown>;
	private _performanceMonitor: PerformanceMonitor;
	private _lastResponse: IAdvancedChatResponse | undefined;

	constructor() {
		super();

		this._conversationManager = this._register(new ConversationStateManager());
		this._contextManager = new ContextProviderManager();
		this._streamingHandler = this._register(new StreamingResponseHandler());
		this._toolRegistry = new ToolRegistry();
		this._promptTemplates = new PromptTemplateManager();
		this._memory = this._register(new MemoryManager());
		this._history = this._register(new HistoryManager());
		this._codeAnalyzer = new CodeAnalyzer();
		this._contextAwareness = this._register(new ContextAwarenessEngine());
		this._modelRouter = this._register(new MultiModelRouter());
		this._workspaceAnalyzer = this._register(new WorkspaceAnalysisEngine());
		// Phase 3 Systems
		this._multiAgentOrchestrator = this._register(new MultiAgentOrchestrator());
		this._userLearning = this._register(new UserLearningEngine());
		this._customModels = this._register(new CustomModelProviderSystem());
		this._refinementEngine = this._register(new InteractiveRefinementEngine());
		this._knowledgeGraph = this._register(new KnowledgeGraphBuilder());
		// Phase 4 Systems
		this._queryCache = this._register(new QueryCacheManager<unknown>('lru', 100, 50 * 1024 * 1024)); // 50MB limit
		this._responseCache = this._register(new ResponseCache());
		this._batchProcessor = this._register(new BatchProcessor<unknown, unknown>(
			async (item: IBatchItem<unknown>) => item.data,
			{ maxConcurrency: 4, maxRetries: 2 }
		));
		this._performanceMonitor = this._register(new PerformanceMonitor());
	}

	/**
	 * Process a chat request with all advanced features
	 */
	async processRequest(request: IAdvancedChatRequest, token: CancellationToken): Promise<IAdvancedChatResponse> {
		// Create conversation if needed
		let conversation = this._conversationManager.getCurrentConversation();
		if (!conversation) {
			conversation = this._conversationManager.createConversation('Chat Session');
		}

		// Add user message to conversation
		this._conversationManager.addMessage(request.userMessage, 'user');
		this._history.add('user-message', { message: request.userMessage });

		// Create response ID and start streaming if requested
		const responseId = `response-${Date.now()}`;
		if (request.streaming) {
			this._streamingHandler.startStream(responseId);
		}

		try {
			// Get context
			const contextItems = await this._contextManager.getAllContext(request.userMessage, token);

			// Perform code analysis if requested
			let analysis: unknown = undefined;
			if (request.includeCodeAnalysis) {
				analysis = {
					quality: this._codeAnalyzer.analyzeQuality('', 'typescript'),
					refactorings: this._codeAnalyzer.suggestRefactorings(''),
					metrics: this._codeAnalyzer.calculateMetrics(''),
					improvements: this._codeAnalyzer.suggestImprovements(''),
				};
			}

			// Build prompt using template (for future use in streaming)
			if (request.templateId) {
				const rendered = this._promptTemplates.renderTemplate(request.templateId, {
					...request.context,
					userMessage: request.userMessage,
					context: contextItems.map(c => c.value).join('\n'),
				});

				if (rendered) {
					// prompt is generated but not used in this path; can be extended later
				}
			}

			// Execute tools if specified
			let toolResults: unknown[] | undefined;
			if (request.tools && request.tools.length > 0) {
				toolResults = [];
				for (const toolId of request.tools) {
					const tool = this._toolRegistry.getTool(toolId);
					if (tool) {
						// Tool execution would happen here
						toolResults.push({
							toolId,
							result: 'Tool execution placeholder',
						});
					}
				}
			}

			// Store in memory
			this._memory.set(
				`request-${responseId}`,
				{
					userMessage: request.userMessage,
					context: contextItems,
					analysis,
				},
				3600000, // 1 hour TTL
				['chat', 'request']
			);

			// Simulate response
			const responseMessage = this._generateResponse(request.userMessage, contextItems, analysis);

			// Add assistant message to conversation
			this._conversationManager.addMessage(responseMessage, 'assistant', {
				responseId,
				hasAnalysis: !!analysis,
				toolResults: toolResults ? toolResults.length : 0,
			});

			// Stream the response
			if (request.streaming) {
				for (const char of responseMessage) {
					this._streamingHandler.appendChunk(responseId, char);
					await new Promise(resolve => setTimeout(resolve, 10)); // Simulate streaming
				}
				this._streamingHandler.completeStream(responseId);
			}

			// Generate suggestions
			const suggestions = this._generateSuggestions(request.userMessage);

			// Log to history
			this._history.add('assistant-response', {
				message: responseMessage,
				suggestions,
				analysis,
			});

			return {
				id: responseId,
				conversationId: conversation.id,
				message: responseMessage,
				suggestions,
				analysis,
				toolResults,
			};
		} catch (error) {
			if (request.streaming) {
				this._streamingHandler.errorStream(responseId, error instanceof Error ? error : new Error(String(error)));
			}
			throw error;
		}
	}

	/**
	 * Register a context provider
	 */
	registerContextProvider(provider: IContextProvider): void {
		this._contextManager.registerProvider(provider);
	}

	/**
	 * Register a tool
	 */
	registerTool(tool: ITool): void {
		this._toolRegistry.registerTool(tool);
	}

	/**
	 * Get current conversation
	 */
	getCurrentConversation(): IConversationState | undefined {
		return this._conversationManager.getCurrentConversation();
	}

	/**
	 * Get all conversations
	 */
	getAllConversations(): IConversationState[] {
		return this._conversationManager.getAllConversations();
	}

	/**
	 * Export conversation
	 */
	exportConversation(id: string): string {
		return this._conversationManager.exportConversation(id);
	}

	/**
	 * Get memory stats
	 */
	getMemoryStats(): unknown {
		return this._memory.getStats();
	}

	/**
	 * Get history
	 */
	getHistory(type?: string): unknown[] {
		if (type) {
			return this._history.getByType(type);
		}
		return this._history.getAll();
	}

	private _generateResponse(userMessage: string, contextItems: unknown[], analysis: unknown): string {
		// Generate a contextual response based on the request
		let response = '';

		if (analysis && typeof analysis === 'object') {
			response += 'Based on code analysis:\n';
			const analysisObj = analysis as Record<string, unknown>;
			if (analysisObj.metrics && typeof analysisObj.metrics === 'object') {
				const metricsObj = analysisObj.metrics as Record<string, unknown>;
				response += `- Maintainability Index: ${metricsObj.maintainabilityIndex}\n`;
				response += `- Cyclomatic Complexity: ${metricsObj.cyclomatic}\n`;
			}
		}

		if (contextItems && Array.isArray(contextItems) && contextItems.length > 0) {
			response += `\nRelevant context found:\n`;
			response += contextItems.slice(0, 3).map(c => {
				if (typeof c === 'object' && c !== null) {
					const cObj = c as Record<string, unknown>;
					const label = cObj.label;
					if (label !== undefined) {
						return `- ${String(label)}`;
					}
				}
				return `- ${String(c)}`;
			}).join('\n');
		}

		if (response === '') {
			response = `I understand you want help with: "${userMessage}"\n\nI can assist with:
- Code generation and refactoring
- Performance optimization
- Bug diagnosis and fixing
- Documentation generation
- Unit test creation
- Architecture design`;
		}

		return response;
	}

	private _generateSuggestions(userMessage: string): string[] {
		const suggestions: string[] = [];

		if (userMessage.toLowerCase().includes('generate')) {
			suggestions.push('Generate unit tests for this code');
			suggestions.push('Create documentation');
		}

		if (userMessage.toLowerCase().includes('bug') || userMessage.toLowerCase().includes('error')) {
			suggestions.push('Analyze error patterns');
			suggestions.push('Generate test cases for edge cases');
		}

		if (userMessage.toLowerCase().includes('review') || userMessage.toLowerCase().includes('refactor')) {
			suggestions.push('Show refactoring suggestions');
			suggestions.push('Calculate code metrics');
		}

		if (suggestions.length === 0) {
			suggestions.push('Explain this code');
			suggestions.push('Suggest optimizations');
			suggestions.push('Generate tests');
		}

		return suggestions.slice(0, 3);
	}

	// --- Advanced Features Access ---

	/**
	 * Get context awareness engine for intelligent context detection
	 */
	getContextAwareness(): ContextAwarenessEngine {
		return this._contextAwareness;
	}

	/**
	 * Get model router for intelligent model selection
	 */
	getModelRouter(): MultiModelRouter {
		return this._modelRouter;
	}

	/**
	 * Get workspace analyzer for project understanding
	 */
	getWorkspaceAnalyzer(): WorkspaceAnalysisEngine {
		return this._workspaceAnalyzer;
	}

	/**
	 * Get last response for followup handling
	 */
	getLastResponse(): IAdvancedChatResponse | undefined {
		return this._lastResponse;
	}

	/**
	 * Intelligently enhance processing with advanced features
	 */
	async enhanceRequest(request: IAdvancedChatRequest, token: CancellationToken): Promise<IAdvancedChatRequest> {
		// Use context awareness to enhance request
		const context = await this._contextAwareness.getContextForQuery(request.userMessage, undefined, token);

		// Determine best template
		if (!request.templateId) {
			request.templateId = this._contextAwareness.getSuggestedTemplate(request.userMessage);
		}

		// Add recommended tools
		if (!request.tools || request.tools.length === 0) {
			const recommended = this._contextAwareness.getRecommendedTools(request.userMessage);
			if (recommended.length > 0) {
				request.tools = recommended;
			}
		}

		// Determine which model to use
		const model = this._modelRouter.routeQuery(
			request.userMessage,
			request.includeCodeAnalysis ? 'quality' : 'speed'
		);

		// Store routing decision in context
		request.context = {
			...request.context,
			selectedModel: model.id,
			detectedContext: context.semanticContext
		};

		return request;
	}

	// --- Phase 3 Advanced Systems ---

	/**
	 * Get multi-agent orchestrator for complex task coordination
	 */
	getMultiAgentOrchestrator(): MultiAgentOrchestrator {
		return this._multiAgentOrchestrator;
	}

	/**
	 * Get user learning engine for preference tracking
	 */
	getUserLearning(): UserLearningEngine {
		return this._userLearning;
	}

	/**
	 * Get custom model provider system
	 */
	getCustomModelSystem(): CustomModelProviderSystem {
		return this._customModels;
	}

	/**
	 * Get interactive refinement engine
	 */
	getRefinementEngine(): InteractiveRefinementEngine {
		return this._refinementEngine;
	}

	/**
	 * Get knowledge graph for codebase understanding
	 */
	getKnowledgeGraph(): KnowledgeGraphBuilder {
		return this._knowledgeGraph;
	}

	/**
	 * Record interaction for learning
	 */
	recordInteraction(quality: number, feedback?: 'positive' | 'negative' | 'neutral'): void {
		const event: IInteractionEvent = {
			timestamp: Date.now(),
			queryId: `query-${Date.now()}`,
			query: this._lastResponse?.message ?? 'unknown',
			selectedAgent: 'orchestrator',
			responseQuality: quality,
			userFeedback: feedback,
			refinementCount: 0,
			timeToFirstResponse: 0,
			documentedCode: false,
			codeGenerated: false
		};
		this._userLearning.recordInteraction(event);
	}

	/**
	 * Apply query refinement
	 */
	async refineQuery(originalQuery: string, refinementType: 'clarify' | 'expand' | 'focus' | 'alternative' | 'simplify', token?: CancellationToken): Promise<string> {
		const suggestions = await this._refinementEngine.generateSuggestions(originalQuery, token);
		if (suggestions.length > 0) {
			return suggestions[0].refinedQuery;
		}
		return originalQuery;
	}

	// --- Phase 4 Performance & Caching Systems ---

	/**
	 * Get query cache manager for caching query results
	 */
	getQueryCache(): QueryCacheManager<unknown> {
		return this._queryCache;
	}

	/**
	 * Get response cache for caching model responses
	 */
	getResponseCache(): ResponseCache {
		return this._responseCache;
	}

	/**
	 * Get batch processor for parallel query processing
	 */
	getBatchProcessor(): BatchProcessor<unknown, unknown> {
		return this._batchProcessor;
	}

	/**
	 * Get performance monitor for tracking system metrics
	 */
	getPerformanceMonitor(): PerformanceMonitor {
		return this._performanceMonitor;
	}
}

