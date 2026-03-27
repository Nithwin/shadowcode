/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';

export type ToolType = 'terminal' | 'file' | 'symbol' | 'refactor' | 'analyze' | 'generate' | 'debug';

export interface IToolDefinition {
	id: string;
	name: string;
	description: string;
	type: ToolType;
	parameters: Array<{
		name: string;
		type: string;
		description: string;
		required: boolean;
		choices?: string[];
	}>;
	examples?: Array<{
		input: string;
		description: string;
	}>;
}

export interface IToolInput {
	toolId: string;
	parameters: Record<string, unknown>;
}

export interface IToolResult {
	toolId: string;
	success: boolean;
	output: string;
	error?: Error;
	metadata?: Record<string, unknown>;
}

export interface ITool {
	readonly definition: IToolDefinition;
	execute(input: IToolInput, token: CancellationToken): Promise<IToolResult>;
}

/**
 * Tool registry and executor
 */
export class ToolRegistry {
	private _tools: Map<string, ITool> = new Map();

	/**
	 * Register a tool
	 */
	registerTool(tool: ITool): void {
		this._tools.set(tool.definition.id, tool);
	}

	/**
	 * Unregister a tool
	 */
	unregisterTool(id: string): void {
		this._tools.delete(id);
	}

	/**
	 * Get a tool
	 */
	getTool(id: string): ITool | undefined {
		return this._tools.get(id);
	}

	/**
	 * Get all tools
	 */
	getAllTools(): ITool[] {
		return Array.from(this._tools.values());
	}

	/**
	 * Get tools by type
	 */
	getToolsByType(type: ToolType): ITool[] {
		return Array.from(this._tools.values()).filter(tool => tool.definition.type === type);
	}

	/**
	 * Execute a tool
	 */
	async executeTool(input: IToolInput, token: CancellationToken): Promise<IToolResult> {
		const tool = this._tools.get(input.toolId);
		if (!tool) {
			return {
				toolId: input.toolId,
				success: false,
				output: '',
				error: new Error(`Tool ${input.toolId} not found`),
			};
		}

		try {
			return await tool.execute(input, token);
		} catch (error) {
			return {
				toolId: input.toolId,
				success: false,
				output: '',
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	}
}

/**
 * File tool for reading/writing files
 */
export class FileTool implements ITool {
	readonly definition: IToolDefinition = {
		id: 'file-read-write',
		name: 'File Operations',
		description: 'Read and write files in the workspace',
		type: 'file',
		parameters: [
			{
				name: 'action',
				type: 'string',
				description: 'Action to perform (read, write, create, delete)',
				required: true,
				choices: ['read', 'write', 'create', 'delete'],
			},
			{
				name: 'path',
				type: 'string',
				description: 'File path',
				required: true,
			},
			{
				name: 'content',
				type: 'string',
				description: 'File content (for write/create actions)',
				required: false,
			},
		],
		examples: [
			{
				input: 'action: read, path: src/index.ts',
				description: 'Read a file',
			},
			{
				input: 'action: write, path: src/index.ts, content: console.log("hello")',
				description: 'Write to a file',
			},
		],
	};

	constructor(
		private _readFile: (path: string) => Promise<string>,
		private _writeFile: (path: string, content: string) => Promise<void>,
		private _deleteFile: (path: string) => Promise<void>,
	) { }

	async execute(input: IToolInput, token: CancellationToken): Promise<IToolResult> {
		const { action, path, content } = input.parameters as { action: unknown; path: unknown; content?: unknown };

		try {
			let output: string = '';
			const pathStr = String(path);
			const actionStr = String(action);
			const contentStr = content ? String(content) : '';

			switch (actionStr) {
				case 'read':
					output = await this._readFile(pathStr);
					break;
				case 'write':
				case 'create':
					await this._writeFile(pathStr, contentStr || '');
					output = `File ${pathStr} ${actionStr === 'create' ? 'created' : 'written'} successfully`;
					break;
				case 'delete':
					await this._deleteFile(pathStr);
					output = `File ${pathStr} deleted successfully`;
					break;
				default:
					throw new Error(`Unknown action: ${actionStr}`);
			}

			return {
				toolId: input.toolId,
				success: true,
				output,
			};
		} catch (error) {
			return {
				toolId: input.toolId,
				success: false,
				output: '',
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	}
}

/**
 * Terminal tool for running commands
 */
export class TerminalTool implements ITool {
	readonly definition: IToolDefinition = {
		id: 'terminal-execute',
		name: 'Terminal',
		description: 'Execute terminal commands',
		type: 'terminal',
		parameters: [
			{
				name: 'command',
				type: 'string',
				description: 'Command to execute',
				required: true,
			},
			{
				name: 'cwd',
				type: 'string',
				description: 'Working directory',
				required: false,
			},
		],
		examples: [
			{
				input: 'command: npm run build',
				description: 'Run npm build',
			},
		],
	};

	constructor(
		private _executeCommand: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
	) { }

	async execute(input: IToolInput, token: CancellationToken): Promise<IToolResult> {
		const { command, cwd } = input.parameters as { command: unknown; cwd?: unknown };

		try {
			const commandStr = String(command);
			const cwdStr = cwd ? String(cwd) : undefined;
			const result = await this._executeCommand(commandStr, cwdStr);
			const output = result.stdout + (result.stderr ? `\nStderr: ${result.stderr}` : '');

			return {
				toolId: input.toolId,
				success: result.exitCode === 0,
				output,
				metadata: { exitCode: result.exitCode },
			};
		} catch (error) {
			return {
				toolId: input.toolId,
				success: false,
				output: '',
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	}
}

/**
 * Refactoring tool for code transformations
 */
export class RefactoringTool implements ITool {
	readonly definition: IToolDefinition = {
		id: 'refactor-code',
		name: 'Code Refactoring',
		description: 'Refactor code automatically',
		type: 'refactor',
		parameters: [
			{
				name: 'action',
				type: 'string',
				description: 'Refactoring action',
				required: true,
				choices: ['rename', 'extract-function', 'inline', 'move'],
			},
			{
				name: 'file',
				type: 'string',
				description: 'File to refactor',
				required: true,
			},
			{
				name: 'position',
				type: 'number',
				description: 'Position in file',
				required: true,
			},
			{
				name: 'newName',
				type: 'string',
				description: 'New name (for rename)',
				required: false,
			},
		],
	};

	constructor(
		private _refactor: (action: string, file: string, position: number, options: Record<string, unknown>) => Promise<string>,
	) { }

	async execute(input: IToolInput, token: CancellationToken): Promise<IToolResult> {
		const { action, file, position, newName } = input.parameters as { action: unknown; file: unknown; position: unknown; newName?: unknown };

		try {
			const actionStr = String(action);
			const fileStr = String(file);
			const positionNum = typeof position === 'number' ? position : Number(position);
			const output = await this._refactor(actionStr, fileStr, positionNum, { newName });

			return {
				toolId: input.toolId,
				success: true,
				output,
			};
		} catch (error) {
			return {
				toolId: input.toolId,
				success: false,
				output: '',
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	}
}
