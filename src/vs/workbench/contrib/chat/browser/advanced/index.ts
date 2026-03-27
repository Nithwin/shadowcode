/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export { ConversationStateManager, type IChatMessage, type IConversationState, type IConversationSnapshot } from './conversationStateManager.js';
export { ContextProviderManager, FileContextProvider, DiagnosticContextProvider, SymbolContextProvider, type IContextItem, type IContextProvider } from './contextProviders.js';
export { StreamingResponseHandler, StreamAccumulator, type IStreamingResponse } from './streamingResponseHandler.js';
export { ToolRegistry, FileTool, TerminalTool, RefactoringTool, type IToolDefinition, type IToolInput, type IToolResult, type ITool } from './toolRegistry.js';
export { PromptTemplateManager, type IPromptTemplate, type IRenderedPrompt } from './promptTemplates.js';
export { MemoryManager, HistoryManager, type IMemoryEntry, type IMemorySnapshot } from './memoryManager.js';
export { CodeAnalyzer, type ICodeIssue, type IRefactoringSuggestion, type ICodeMetrics } from './codeAnalyzer.js';
export { AdvancedChatOrchestrator, type IAdvancedChatRequest, type IAdvancedChatResponse } from './advancedChatOrchestrator.js';

// Phase 2 - Advanced Features
export { AdvancedChatContribution } from './advancedChatContribution.js';
export { ContextAwarenessEngine, type IAwareneessContext, type ISymbolInfo, type ITypeInfo } from './contextAwarenessEngine.js';
export { MultiModelRouter, ModelType, type ILanguageModel, type IModelRequest, type IModelResponse } from './multiModelRouter.js';
export { WorkspaceAnalysisEngine, type IProjectStructure, type ICodeMetrics as IWorkspaceCodeMetrics, type IArchitecturePattern } from './workspaceAnalysisEngine.js';

// Phase 3 - Intelligence & Orchestration
export { MultiAgentOrchestrator, type ISpecializedAgent, type IAgentResponse, type IMultiAgentRequest, type IOrchestrationResult } from './multiAgentOrchestrator.js';
export { UserLearningEngine, type IInteractionEvent, type IUserPreference, type ILearningStats } from './userLearningEngine.js';
export { CustomModelProviderSystem, OllamaModelProvider, type IModelProvider, type IInvokeOptions, type IModelRegistry, type IModelStats } from './customModelProvider.js';
export { InteractiveRefinementEngine, type IRefinementInput, type IRefinementSuggestion, type IRefinementResult } from './interactiveRefinementEngine.js';
export { KnowledgeGraphBuilder, type IKnowledgeNode, type IKnowledgeEdge, type IKnowledgeQuery, type IPathQuery } from './knowledgeGraphBuilder.js';

// Phase 4 - Performance & Caching
export { QueryCacheManager, type ICacheEntry, type ICacheStats, type ICachePolicy } from './queryCacheManager.js';
export { ResponseCache, type IResponseCacheEntry, type IResponseCacheStats } from './responseCache.js';
export { BatchProcessor, type IBatchItem, type IBatchResult, type IBatchStats } from './batchProcessor.js';
export { PerformanceMonitor, type IMetricSample, type IPerformanceMetrics, type IPerformanceReport } from './performanceMonitor.js';
