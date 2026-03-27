/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { AdvancedChatOrchestrator } from './advancedChatOrchestrator.js';
import { FileContextProvider, SymbolContextProvider, DiagnosticContextProvider } from './contextProviders.js';
import { FileTool, TerminalTool, RefactoringTool } from './toolRegistry.js';

/**
 * Advanced Chat Integration - Provides integration setup for advanced chat features
 *
 * This module handles initialization and setup of all advanced chat components:
 * - Context providers
 * - Tools
 * - Memory systems
 * - Analysis engines
 */
export class AdvancedChatIntegration extends Disposable {
	private readonly _disposables = new DisposableStore();

	private _orchestrator: AdvancedChatOrchestrator;

	constructor() {
		super();

		this._orchestrator = this._register(new AdvancedChatOrchestrator());
		this._setupDefaultProviders();
		this._setupDefaultTools();
	}

	private _setupDefaultProviders(): void {
		// Register default context providers
		this._orchestrator.registerContextProvider(
			new FileContextProvider(
				() => 'src/index.ts',
				(file) => ['src/types.ts', 'src/utils.ts']
			)
		);

		this._orchestrator.registerContextProvider(
			new SymbolContextProvider(
				(query) => [
					{
						name: 'MyInterface',
						kind: 'interface',
						file: 'src/types.ts',
						range: { start: 0, end: 50 }
					}
				]
			)
		);

		// Diagnostic provider with default error/warning detection
		this._orchestrator.registerContextProvider(
			new DiagnosticContextProvider(() => [
				{
					message: 'Unused variable',
					file: 'src/index.ts',
					line: 10
				}
			])
		);
	}

	private _setupDefaultTools(): void {
		// Register default tools
		this._orchestrator.registerTool(
			new FileTool(
				async (path) => `// Content of ${path}`,
				async (path, content) => { console.log(`Write to ${path}`); },
				async (path) => { console.log(`Delete ${path}`); }
			)
		);

		this._orchestrator.registerTool(
			new TerminalTool(
				async (command) => ({
					stdout: `Output of: ${command}`,
					stderr: '',
					exitCode: 0
				})
			)
		);

		this._orchestrator.registerTool(
			new RefactoringTool(
				async (action, file, position, options) => `Refactoring: ${action}`
			)
		);
	}

	/**
	 * Get the orchestrator instance
	 */
	getOrchestrator(): AdvancedChatOrchestrator {
		return this._orchestrator;
	}

	override dispose(): void {
		this._disposables.dispose();
		super.dispose();
	}
}

/**
 * Factory function to create integration instance
 */
export function createAdvancedChatIntegration(): AdvancedChatIntegration {
	return new AdvancedChatIntegration();
}
