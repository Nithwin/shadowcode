/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

export interface IShadowAIToolContext {
	readonly fileService: IFileService;
	readonly workspaceContextService: IWorkspaceContextService;
	// Future: ITerminalService
}

export interface IShadowAITool {
	readonly name: string;
	readonly description: string;
	readonly parameters: Record<string, { type: string; description: string }>;
	execute(args: Record<string, string>, context: IShadowAIToolContext): Promise<string>;
}

export const shadowAITools: IShadowAITool[] = [
	{
		name: 'list_dir',
		description: 'Lists the files and folders inside a given directory. Use this to explore the project structure.',
		parameters: {
			path: { type: 'string', description: 'The absolute or workspace-relative path to list.' }
		},
		async execute(args, context) {
			try {
				const uri = resolveWorkspaceUri(args.path, context);
				if (!uri) { return `Error: Could not resolve path '${args.path}'.`; }

				const stat = await context.fileService.resolve(uri, { resolveSingleChildDescendants: true });
				if (!stat.isDirectory || !stat.children) {
					return `Error: '${args.path}' is not a directory.`;
				}

				const items = stat.children.map(c => `${c.isDirectory ? '[DIR] ' : '[FILE] '}${c.name}`);
				return `Contents of ${args.path}:\n${items.join('\n')}`;
			} catch (e: unknown) {
				return `Error executing list_dir: ${(e as Error).message}`;
			}
		}
	},
	{
		name: 'read_file',
		description: 'Reads the exact contents of a file.',
		parameters: {
			path: { type: 'string', description: 'The absolute or workspace-relative path to the file.' }
		},
		async execute(args, context) {
			try {
				const uri = resolveWorkspaceUri(args.path, context);
				if (!uri) { return `Error: Could not resolve path '${args.path}'.`; }

				const file = await context.fileService.readFile(uri);
				return file.value.toString();
			} catch (e: unknown) {
				return `Error executing read_file: ${(e as Error).message}`;
			}
		}
	},
	{
		name: 'edit_file',
		description: 'Replaces a specific block of code in a file. The search block must match the existing file exactly.',
		parameters: {
			path: { type: 'string', description: 'The path to the file.' },
			search: { type: 'string', description: 'The EXACT block of code to search for and replace.' },
			replace: { type: 'string', description: 'The new block of code to insert.' }
		},
		async execute(args, context) {
			try {
				const uri = resolveWorkspaceUri(args.path, context);
				if (!uri) { return `Error: Could not resolve path '${args.path}'.`; }

				const file = await context.fileService.readFile(uri);
				const content = file.value.toString();

				if (!content.includes(args.search)) {
					return `Error: Search block not found in file. Ensure exact spacing and indentation.`;
				}

				const modified = content.replace(args.search, args.replace);
				await context.fileService.writeFile(uri, VSBuffer.fromString(modified));
				return `Successfully edited ${args.path}.`;
			} catch (e: unknown) {
				return `Error executing edit_file: ${(e as Error).message}`;
			}
		}
	},
	{
		name: 'create_file',
		description: 'Creates or overwrites a file with the given content.',
		parameters: {
			path: { type: 'string', description: 'The path to the file to create.' },
			content: { type: 'string', description: 'The full content of the file.' }
		},
		async execute(args: Record<string, string>, context: IShadowAIToolContext) {
			try {
				const uri = resolveWorkspaceUri(args.path, context);
				if (!uri) { return `Error: Could not resolve path '${args.path}'.`; }
				await context.fileService.writeFile(uri, VSBuffer.fromString(args.content || ''));
				return `Successfully created/updated ${args.path}.`;
			} catch (e: unknown) {
				return `Error executing create_file: ${(e as Error).message}`;
			}
		}
	},
	{
		name: 'delete_file',
		description: 'Deletes a file from the workspace.',
		parameters: {
			path: { type: 'string', description: 'The path to the file to delete.' }
		},
		async execute(args: Record<string, string>, context: IShadowAIToolContext) {
			try {
				const uri = resolveWorkspaceUri(args.path, context);
				if (!uri) { return `Error: Could not resolve path '${args.path}'.`; }
				await context.fileService.del(uri);
				return `Successfully deleted ${args.path}.`;
			} catch (e: unknown) {
				return `Error executing delete_file: ${(e as Error).message}`;
			}
		}
	},
	{
		name: 'update_memory',
		description: 'Writes thoughts, plans, or task summaries to your context memory. Use this tool BEFORE making major file edits to ensure you explicitly plan the changes.',
		parameters: {
			thought: { type: 'string', description: 'Your detailed thought process or plan.' },
			taskStatus: { type: 'string', description: 'Pithy 1-line status of what you are doing right now.' }
		},
		async execute(args: Record<string, string>, context: IShadowAIToolContext) {
			try {
				const workspace = context.workspaceContextService.getWorkspace();
				if (!workspace.folders || workspace.folders.length === 0) {
					return 'Error: No workspace open to save memory.';
				}
				const memoryUri = URI.joinPath(workspace.folders[0].uri, '.shadowcode', 'AGENT_MEMORY.md');

				let content = '';
				try {
					const file = await context.fileService.readFile(memoryUri);
					content = file.value.toString();
				} catch {
					content = '# Shadow AI Agent Memory\n\n';
				}

				const entry = `\n## [${new Date().toISOString()}] Status: ${args.taskStatus}\n${args.thought}\n`;
				content = (content + entry).slice(-5000); // Keep last 5kb
				await context.fileService.writeFile(memoryUri, VSBuffer.fromString(content));

				return `Memory updated successfully. Mode: ${args.taskStatus}`;
			} catch (e: unknown) {
				return `Error executing update_memory: ${(e as Error).message}`;
			}
		}
	},
	{
		name: 'grep_search',
		description: 'Search for a text pattern across all workspace files. Returns matching file paths, line numbers, and snippets. Use this to find where functions, variables, or strings are defined or used.',
		parameters: {
			query: { type: 'string', description: 'The text or pattern to search for.' },
			includes: { type: 'string', description: 'Optional glob pattern to filter files, e.g. "*.ts" or "*.py".' }
		},
		async execute(args: Record<string, string>, context: IShadowAIToolContext) {
			try {
				const workspace = context.workspaceContextService.getWorkspace();
				if (!workspace.folders || workspace.folders.length === 0) {
					return 'Error: No workspace folder open.';
				}
				const query = args.query;
				if (!query || query.length < 2) {
					return 'Error: Query must be at least 2 characters.';
				}

				const rootUri = workspace.folders[0].uri;
				const results: string[] = [];
				const MAX_RESULTS = 30;
				const MAX_FILE_SIZE = 100000; // Skip files > 100KB
				const includeGlob = args.includes || '';

				// Recursive file walker with search
				const searchDir = async (dirUri: URI, depth: number) => {
					if (depth > 5 || results.length >= MAX_RESULTS) { return; }
					try {
						const stat = await context.fileService.resolve(dirUri, { resolveSingleChildDescendants: false });
						if (!stat.isDirectory || !stat.children) { return; }

						for (const child of stat.children) {
							if (results.length >= MAX_RESULTS) { break; }

							if (child.isDirectory) {
								const name = child.name.toLowerCase();
								if (['node_modules', '.git', 'out', 'dist', '.next', '.cache', 'coverage'].includes(name)) { continue; }
								await searchDir(child.resource, depth + 1);
							} else if (child.isFile) {
								// Apply glob filter
								if (includeGlob && !child.name.endsWith(includeGlob.replace('*', ''))) { continue; }
								if (child.size && child.size > MAX_FILE_SIZE) { continue; }

								try {
									const file = await context.fileService.readFile(child.resource, { length: MAX_FILE_SIZE });
									const text = file.value.toString();
									const lines = text.split('\n');
									const relPath = child.resource.path.substring(rootUri.path.length + 1);

									for (let i = 0; i < lines.length; i++) {
										if (results.length >= MAX_RESULTS) { break; }
										if (lines[i].includes(query)) {
											results.push(`${relPath}:${i + 1}: ${lines[i].trim().substring(0, 150)}`);
										}
									}
								} catch {
									// Skip unreadable files
								}
							}
						}
					} catch {
						// Skip inaccessible directories
					}
				};

				await searchDir(rootUri, 0);

				if (results.length === 0) {
					return `No matches found for "${query}".`;
				}
				return `Found ${results.length} match(es) for "${query}":\n${results.join('\n')}`;
			} catch (e: unknown) {
				return `Error executing grep_search: ${(e as Error).message}`;
			}
		}
	},
	{
		name: 'run_command',
		description: 'Execute a shell command in the workspace root directory. Use for running builds, tests, linters, or npm scripts.',
		parameters: {
			command: { type: 'string', description: 'The shell command to run, e.g. "npm test" or "ls -la".' }
		},
		async execute(args: Record<string, string>, context: IShadowAIToolContext) {
			try {
				const cmd = (args.command || '').trim();
				if (!cmd) { return 'Error: No command provided.'; }

				// Security: Block dangerous commands
				const BLOCKED = ['rm -rf /', 'sudo', 'mkfs', 'dd if=', ':(){', 'chmod -R 777 /'];
				for (const b of BLOCKED) {
					if (cmd.includes(b)) {
						return `Error: Command blocked for safety: "${b}"`;
					}
				}

				// Use the workspace root as cwd
				const workspace = context.workspaceContextService.getWorkspace();
				const cwd = workspace.folders?.[0]?.uri.fsPath || '/tmp';

				// Execute via child_process (available in Node.js Electron main process)
				const { exec } = await import('child_process');
				const result = await new Promise<string>((resolve) => {
					exec(cmd, { cwd, timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
						const output: string[] = [];
						if (stdout) { output.push(stdout.toString()); }
						if (stderr) { output.push(`STDERR:\n${stderr.toString()}`); }
						if (error && !stdout && !stderr) { output.push(`Error: ${error.message}`); }
						const combined = output.join('\n').substring(0, 5000);
						resolve(combined || '(no output)');
					});
				});

				return `$ ${cmd}\n${result}`;
			} catch (e: unknown) {
				return `Error executing run_command: ${(e as Error).message}`;
			}
		}
	}
];

function resolveWorkspaceUri(filePath: string, context: IShadowAIToolContext): URI | undefined {
	if (!filePath) { return undefined; }
	const workspace = context.workspaceContextService.getWorkspace();
	if (!workspace.folders || workspace.folders.length === 0) {
		return undefined;
	}

	// Basic path traversal protection
	if (filePath.includes('../') || filePath.startsWith('/')) {
		return undefined;
	}

	return URI.joinPath(workspace.folders[0].uri, filePath);
}

export function parseToolCalls(text: string): { name: string; args: Record<string, string>; fullTag: string }[] {
	const tools: { name: string; args: Record<string, string>; fullTag: string }[] = [];

	// 1. Try the new <TOOL_CALL> JSON format first
	const toolCallRegex = /<TOOL_CALL>([\s\S]*?)<\/TOOL_CALL>/g;
	let match;
	while ((match = toolCallRegex.exec(text)) !== null) {
		try {
			const jsonStr = match[1].trim();
			const parsed = JSON.parse(jsonStr);
			if (parsed.name && parsed.arguments) {
				tools.push({ name: parsed.name, args: parsed.arguments, fullTag: match[0] });
			}
		} catch { } // Ignore malformed JSON
	}

	// 2. Fallbacks: Robust tag indexer for <CREATE> and <EDIT> tags (handles unclosed tags)
	const tagRegex = /<(CREATE|EDIT)\s+file="([^"]+)"\s*>/gi;
	const matches = [];
	while ((match = tagRegex.exec(text)) !== null) {
		matches.push({ type: match[1].toUpperCase(), file: match[2], index: match.index, end: tagRegex.lastIndex });
	}

	for (let i = 0; i < matches.length; i++) {
		const current = matches[i];
		const next = matches[i + 1];

		// Content spans from the end of the opening tag to the start of the next tag, or end of string.
		const endIdx = next ? next.index : text.length;
		let content = text.substring(current.end, endIdx);

		// Strip out the closing tag if it successfully matched the regex chunk
		content = content.replace(new RegExp(`<\\/\\s*${current.type}\\s*>`, 'i'), '');

		// Also strip out any stray </THOUGHT> or </TOOL_CALL> closures inside the code
		content = content.replace(/<\/?THOUGHT>/gi, '').replace(/<\/?TOOL_CALL>/gi, '');

		// Strip outer markdown code blocks if the AI decided to wrap the file contents in them.
		content = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();

		tools.push({
			name: 'create_file', // Both legacy CREATE and EDIT(full file wrapper) route to create_file
			args: { path: current.file, content: content },
			fullTag: text.substring(current.index, endIdx)
		});
	}

	// 3. Fallback: Detect legacy <DELETE file="path" /> blocks
	const deleteRegex = /<DELETE\s+file="([^"]+)"\s*\/>/gi;
	while ((match = deleteRegex.exec(text)) !== null) {
		tools.push({
			name: 'delete_file',
			args: { path: match[1].trim() },
			fullTag: match[0]
		});
	}

	return tools;
}

