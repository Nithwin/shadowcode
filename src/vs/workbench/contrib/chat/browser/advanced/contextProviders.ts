/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';

export interface IContextItem {
	id: string;
	type: 'file' | 'symbol' | 'diagnostic' | 'related' | 'memory' | 'search-result';
	label: string;
	description?: string;
	value: string;
	range?: { start: number; end: number };
	metadata?: Record<string, unknown>;
}

export interface IContextProvider {
	readonly id: string;
	readonly priority: number;
	provideContext(query: string, token: CancellationToken): Promise<IContextItem[]>;
}

/**
 * Manager for context providers
 */
export class ContextProviderManager {
	private _providers: Map<string, IContextProvider> = new Map();
	private _sortedProviders: IContextProvider[] = [];

	/**
	 * Register a context provider
	 */
	registerProvider(provider: IContextProvider): void {
		this._providers.set(provider.id, provider);
		this._updateSortedProviders();
	}

	/**
	 * Unregister a context provider
	 */
	unregisterProvider(id: string): void {
		this._providers.delete(id);
		this._updateSortedProviders();
	}

	/**
	 * Get all context items from all providers
	 */
	async getAllContext(query: string, token: CancellationToken, limit: number = 50): Promise<IContextItem[]> {
		const contexts = await Promise.all(
			this._sortedProviders.map(provider => provider.provideContext(query, token))
		);

		const allItems = contexts.flat();
		// Remove duplicates by id and limit results
		const seen = new Set<string>();
		const result: IContextItem[] = [];

		for (const item of allItems) {
			if (!seen.has(item.id) && result.length < limit) {
				seen.add(item.id);
				result.push(item);
			}
		}

		return result;
	}

	/**
	 * Get context from a specific provider
	 */
	async getContextFromProvider(providerId: string, query: string, token: CancellationToken): Promise<IContextItem[]> {
		const provider = this._providers.get(providerId);
		if (!provider) {
			return [];
		}
		return provider.provideContext(query, token);
	}

	private _updateSortedProviders(): void {
		this._sortedProviders = Array.from(this._providers.values())
			.sort((a, b) => b.priority - a.priority);
	}
}

/**
 * File context provider - provides current file and related files
 */
export class FileContextProvider implements IContextProvider {
	readonly id = 'file-context';
	readonly priority = 100;

	constructor(
		private _getCurrentFile: () => string | undefined,
		private _getRelatedFiles: (file: string) => string[],
	) { }

	async provideContext(query: string, token: CancellationToken): Promise<IContextItem[]> {
		const currentFile = this._getCurrentFile();
		if (!currentFile) {
			return [];
		}

		const items: IContextItem[] = [
			{
				id: `file:${currentFile}`,
				type: 'file',
				label: currentFile,
				description: 'Current file',
				value: currentFile,
			},
		];

		const relatedFiles = this._getRelatedFiles(currentFile);
		for (const file of relatedFiles) {
			items.push({
				id: `file:${file}`,
				type: 'related',
				label: file,
				description: 'Related file',
				value: file,
			});
		}

		return items;
	}
}

/**
 * Diagnostic context provider - provides compiler/linter errors
 */
export class DiagnosticContextProvider implements IContextProvider {
	readonly id = 'diagnostic-context';
	readonly priority = 90;

	constructor(
		private _getDiagnostics: () => Array<{ file: string; message: string; line: number }>,
	) { }

	async provideContext(query: string, token: CancellationToken): Promise<IContextItem[]> {
		const diagnostics = this._getDiagnostics();
		return diagnostics.map((diag, index) => ({
			id: `diag:${index}`,
			type: 'diagnostic',
			label: `${diag.file}:${diag.line}`,
			description: diag.message,
			value: `${diag.file}:${diag.line}: ${diag.message}`,
			metadata: { file: diag.file, line: diag.line },
		}));
	}
}

/**
 * Symbol context provider - provides symbols and definitions
 */
export class SymbolContextProvider implements IContextProvider {
	readonly id = 'symbol-context';
	readonly priority = 80;

	constructor(
		private _getSymbols: (query: string) => Array<{ name: string; kind: string; file: string; range: { start: number; end: number } }>,
	) { }

	async provideContext(query: string, token: CancellationToken): Promise<IContextItem[]> {
		const symbols = this._getSymbols(query);
		return symbols.map((symbol, index) => ({
			id: `symbol:${symbol.file}:${symbol.name}`,
			type: 'symbol',
			label: symbol.name,
			description: `${symbol.kind} in ${symbol.file}`,
			value: symbol.name,
			range: symbol.range,
			metadata: { kind: symbol.kind, file: symbol.file },
		}));
	}
}
