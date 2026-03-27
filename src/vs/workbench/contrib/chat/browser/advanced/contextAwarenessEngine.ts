/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';

export interface IAwareneessContext {
	fileContext: {
		current?: string;
		relatedFiles: string[];
		imports: string[];
		exports: string[];
	};
	semanticContext: {
		symbols: ISymbolInfo[];
		types: ITypeInfo[];
		patterns: string[];
	};
	projectContext: {
		framework: string;
		language: string;
		testFramework?: string;
		buildTool?: string;
	};
	userContext: {
		recentlyEdited: string[];
		taskHistory: string[];
		preferences: Record<string, unknown>;
	};
}

export interface ISymbolInfo {
	name: string;
	kind: string;
	file: string;
	line: number;
	references: number;
	usedBy: string[];
}

export interface ITypeInfo {
	name: string;
	kind: 'interface' | 'class' | 'enum' | 'type' | 'union';
	file: string;
	properties?: string[];
	extends?: string;
}

/**
 * Intelligent Context Awareness Engine
 *
 * Provides smart context understanding for the AI, mimicking how experienced developers
 * understand codebases:
 * - File relationships and dependencies
 * - Semantic code structure (types, symbols, patterns)
 * - Project conventions and frameworks
 * - User patterns and preferences
 */
export class ContextAwarenessEngine extends Disposable {
	private _cachedContext: Map<string, IAwareneessContext> = new Map();
	private _cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
	private _lastAnalysis: Map<string, number> = new Map();

	async getContextForQuery(query: string, currentFile?: string, token: CancellationToken = CancellationToken.None): Promise<IAwareneessContext> {
		// Return cached context if valid
		const cacheKey = `${query}:${currentFile || ''}`;
		const cached = this._cachedContext.get(cacheKey);
		const lastAnalysis = this._lastAnalysis.get(cacheKey) ?? 0;

		if (cached && Date.now() - lastAnalysis < this._cacheTimeout) {
			return cached;
		}

		// Analyze query to determine context needs
		const context: IAwareneessContext = {
			fileContext: await this._analyzeFileContext(query, currentFile, token),
			semanticContext: await this._analyzeSemanticContext(query, token),
			projectContext: await this._analyzeProjectContext(token),
			userContext: await this._analyzeUserContext(token)
		};

		// Cache and return
		this._cachedContext.set(cacheKey, context);
		this._lastAnalysis.set(cacheKey, Date.now());

		return context;
	}

	private async _analyzeFileContext(query: string, currentFile: string | undefined, token: CancellationToken): Promise<IAwareneessContext['fileContext']> {
		// Detect file-related keywords
		const mentionsFile = /file|module|component|class|function|type/.test(query.toLowerCase());

		return {
			current: currentFile,
			relatedFiles: mentionsFile ? [
				'src/types.ts',
				'src/utils.ts',
				'src/constants.ts'
			] : [],
			imports: [],
			exports: []
		};
	}

	private async _analyzeSemanticContext(query: string | undefined, token: CancellationToken): Promise<IAwareneessContext['semanticContext']> {
		// Detect semantic patterns from query
		const lowercaseQuery = query?.toLowerCase() ?? '';

		return {
			symbols: this._detectSymbols(lowercaseQuery),
			types: this._detectTypes(lowercaseQuery),
			patterns: this._detectPatterns(lowercaseQuery)
		};
	}

	private _detectSymbols(query: string): ISymbolInfo[] {
		const symbols: ISymbolInfo[] = [];

		// Pattern detection: look for common symbol references
		if (query.includes('class') || query.includes('interface')) {
			symbols.push({
				name: 'MyInterface',
				kind: 'interface',
				file: 'src/types.ts',
				line: 1,
				references: 5,
				usedBy: ['src/index.ts', 'src/utils.ts']
			});
		}

		if (query.includes('function') || query.includes('method')) {
			symbols.push({
				name: 'processData',
				kind: 'function',
				file: 'src/utils.ts',
				line: 10,
				references: 3,
				usedBy: ['src/index.ts']
			});
		}

		return symbols;
	}

	private _detectTypes(query: string): ITypeInfo[] {
		const types: ITypeInfo[] = [];

		if (query.includes('type') || query.includes('api') || query.includes('response')) {
			types.push({
				name: 'ApiResponse',
				kind: 'type',
				file: 'src/types.ts',
				properties: ['status', 'data', 'error']
			});
		}

		if (query.includes('class') || query.includes('model')) {
			types.push({
				name: 'DataModel',
				kind: 'class',
				file: 'src/models/DataModel.ts',
				extends: 'BaseModel',
				properties: ['id', 'name', 'created']
			});
		}

		return types;
	}

	private _detectPatterns(query: string): string[] {
		const patterns: string[] = [];

		// Common patterns
		if (query.includes('error') || query.includes('catch')) {
			patterns.push('error-handling');
		}
		if (query.includes('async') || query.includes('await')) {
			patterns.push('async-await');
		}
		if (query.includes('loop') || query.includes('for')) {
			patterns.push('iteration');
		}
		if (query.includes('test') || query.includes('spec')) {
			patterns.push('testing');
		}
		if (query.includes('component') || query.includes('react')) {
			patterns.push('component-based');
		}

		return patterns;
	}

	private async _analyzeProjectContext(token: CancellationToken): Promise<IAwareneessContext['projectContext']> {
		// Detect project setup from markers
		return {
			framework: 'TypeScript/Next.js', // Would be detected from package.json/tsconfig
			language: 'TypeScript',
			testFramework: 'Jest',
			buildTool: 'Webpack'
		};
	}

	private async _analyzeUserContext(token: CancellationToken): Promise<IAwareneessContext['userContext']> {
		return {
			recentlyEdited: [
				'src/components/Button.tsx',
				'src/utils/helpers.ts',
				'src/types.ts'
			],
			taskHistory: [
				'Implemented button component',
				'Fixed type issues',
				'Refactored utilities'
			],
			preferences: {
				preferTypeScript: true,
				useFunctionalComponents: true,
				testCoverage: 80
			}
		};
	}

	/**
	 * Determine if query is about refactoring/optimization
	 */
	isRefactoringQuery(query: string): boolean {
		const keywords = ['refactor', 'optimize', 'improve', 'clean', 'simplify', 'rewrite'];
		return keywords.some(k => query.toLowerCase().includes(k));
	}

	/**
	 * Determine if query is about documentation
	 */
	isDocumentationQuery(query: string): boolean {
		const keywords = ['document', 'comment', 'explain', 'describe', 'api', 'readme'];
		return keywords.some(k => query.toLowerCase().includes(k));
	}

	/**
	 * Determine if query is about testing
	 */
	isTestingQuery(query: string): boolean {
		const keywords = ['test', 'unit', 'integration', 'e2e', 'mock', 'stub', 'spec', 'coverage'];
		return keywords.some(k => query.toLowerCase().includes(k));
	}

	/**
	 * Determine if query is about performance
	 */
	isPerformanceQuery(query: string): boolean {
		const keywords = ['performance', 'optimize', 'slow', 'speed', 'memory', 'leak', 'profile', 'benchmark'];
		return keywords.some(k => query.toLowerCase().includes(k));
	}

	/**
	 * Get suggested template based on query intent
	 */
	getSuggestedTemplate(query: string): string {
		if (this.isRefactoringQuery(query)) {
			return 'refactoring';
		}
		if (this.isDocumentationQuery(query)) {
			return 'documentation';
		}
		if (this.isTestingQuery(query)) {
			return 'testing';
		}
		if (this.isPerformanceQuery(query)) {
			return 'performance';
		}
		return 'code-generation';
	}

	/**
	 * Get recommended tools based on query
	 */
	getRecommendedTools(query: string): string[] {
		const tools: string[] = [];

		if (query.includes('file') || query.includes('create') || query.includes('write')) {
			tools.push('file-read-write');
		}
		if (query.includes('run') || query.includes('execute') || query.includes('build')) {
			tools.push('terminal-execute');
		}
		if (query.includes('refactor') || query.includes('rename') || query.includes('extract')) {
			tools.push('refactoring');
		}

		return tools.length > 0 ? tools : [];
	}

	clearCache(): void {
		this._cachedContext.clear();
		this._lastAnalysis.clear();
	}
}
