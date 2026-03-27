/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILanguageModelsService, IChatMessage, ChatMessageRole } from '../../chat/common/languageModels.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService, IWorkspaceFolder } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IChatAgentImplementation, IChatAgentRequest, IChatAgentResult, IChatAgentHistoryEntry } from '../../chat/common/participants/chatAgents.js';
import { IChatProgress } from '../../chat/common/chatService/chatService.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { URI } from '../../../../base/common/uri.js';
import { ShadowAIConfiguration } from '../common/shadowAISettings.js';
import { shadowAITools, parseToolCalls } from '../common/shadowAITools.js';
import { sanitizeShadowAIErrorMessage } from '../common/shadowAIRedaction.js';
import { SHADOW_AI_MEMORY_STORAGE_KEY, parseShadowAIMemoryState, buildShadowAIMemoryPrompt } from '../common/shadowAIMemory.js';
import { buildShadowAIModelPlan } from '../common/shadowAIModelPlan.js';

interface IShadowAIWorkspaceFileCandidate {
	readonly resource: URI;
	readonly displayPath: string;
}

export class ShadowChatAgent implements IChatAgentImplementation {

	constructor(
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IStorageService private readonly storageService: IStorageService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IEditorService private readonly editorService: IEditorService
	) { }

	private static readonly WORKSPACE_MAX_FILES = 220;
	private static readonly WORKSPACE_MAX_DEPTH = 4;
	private static readonly WORKSPACE_TREE_PREVIEW_COUNT = 90;
	private static readonly WORKSPACE_SNIPPET_BYTES = 4500;
	private static readonly WORKSPACE_SNIPPET_CHARS = 3000;
	private static readonly SKIPPED_FOLDERS = new Set(['.git', 'node_modules', 'out', 'dist', '.next', '.cache', 'coverage', '.vscode-test', 'vs/workbench/contrib/shadowAI']);
	private static readonly TEXT_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml', '.xml', '.html', '.css', '.scss', '.less', '.py', '.go', '.java', '.rs', '.sh']);
	private static readonly COMMON_STOP_WORDS = new Set(['the', 'this', 'that', 'with', 'from', 'into', 'about', 'need', 'please', 'what', 'when', 'where', 'which', 'show', 'make', 'file', 'files', 'project', 'workspace', 'code', 'chat', 'agent', 'help']);

	private buildModelPlan(userSelectedModelId: string | undefined): readonly string[] {
		const modelIds = this.languageModelsService.getLanguageModelIds();
		if (modelIds.length === 0) {
			return [];
		}

		const defaultModel = this.configurationService.getValue<string>(ShadowAIConfiguration.DefaultModel);
		const providerPriority = this.configurationService.getValue<string[]>(ShadowAIConfiguration.ProviderPriority) || [];
		const workflowProfile = this.configurationService.getValue<'offline' | 'balanced' | 'cloud'>(ShadowAIConfiguration.WorkflowProfile) || 'balanced';
		const maxAttempts = this.configurationService.getValue<number>(ShadowAIConfiguration.MaxModelFallbackAttempts) ?? 4;

		return buildShadowAIModelPlan({
			modelIds,
			userSelectedModelId,
			defaultModel,
			providerPriority,
			workflowProfile,
			maxAttempts
		});
	}

	async invoke(request: IChatAgentRequest, progress: (parts: IChatProgress[]) => void, history: IChatAgentHistoryEntry[], token: CancellationToken): Promise<IChatAgentResult> {
		const modelPlan = this.buildModelPlan(request.userSelectedModelId);
		const userModelStr = request.userSelectedModelId || 'Auto';
		progress([{ kind: 'progressMessage', content: new MarkdownString(`Selected Model: ${userModelStr}`) }]);

		const messages: IChatMessage[] = [];
		const systemParts: string[] = [];

		const memoryState = parseShadowAIMemoryState(this.storageService.get(SHADOW_AI_MEMORY_STORAGE_KEY, StorageScope.WORKSPACE));
		const memoryPrompt = buildShadowAIMemoryPrompt(memoryState, 6);
		if (memoryPrompt) {
			systemParts.push(memoryPrompt);
		}

		const constitution = await this.loadProjectConstitution();
		if (constitution) {
			systemParts.push(constitution);
		}

		const workspacePrompt = await this.buildWorkspacePrompt(request.message, token);
		if (workspacePrompt) {
			systemParts.push(workspacePrompt);
		}

		const activeFilePrompt = await this.getActiveFilePrompt();
		if (activeFilePrompt) {
			systemParts.push(activeFilePrompt);
		}

		systemParts.push(`You are Shadow AI, an advanced autonomous coding agent for ShadowCode — a privacy-first AI code editor.
You are running inside an agentic loop. You can use tools to explore, search, read, write, and execute code.

### TOOL CALLING FORMAT
To use a tool, wrap the JSON in a <TOOL_CALL> block:
<TOOL_CALL>
{"name": "tool_name", "arguments": {"key": "value"}}
</TOOL_CALL>

Alternatively, you can use <CREATE file="path">content</CREATE> or <EDIT file="path">content</EDIT> XML tags.

### AVAILABLE TOOLS
${shadowAITools.map(t => `- **${t.name}**: ${t.description}`).join('\n')}

### WORKFLOW PATTERNS
**Task Memory**: Use update_memory FIRST on any complex task to document your plan!
**Creating files**: Use create_file or <CREATE> tags. Always create complete, working files.
**Finding code**: Use grep_search BEFORE editing to find the exact code. Never guess.
**Editing code**: Use edit_file with precise search/replace blocks. Read the file first!
**Running builds**: Use run_command for npm install, npm test, npm run dev, etc.
**Multi-file tasks**: You can create/edit multiple files across turns. Take it step by step.

### CRITICAL RULES
1. If the user asks for a complex feature, use update_memory to plan it out FIRST!
2. ALWAYS read a file before editing it — never guess at contents.
3. Provide COMPLETE file contents when creating files — never truncate.
4. When finished, reply normally without any tags to end the loop.`);

		if (systemParts.length > 0) {
			messages.push({ role: ChatMessageRole.System, content: [{ type: 'text', value: systemParts.join('\n\n') }] });
		}

		for (const entry of history) {
			if (entry.request) {
				messages.push({ role: ChatMessageRole.User, content: [{ type: 'text', value: entry.request.message }] });
			}
			if (entry.response) {
				let responseText = '';
				for (const part of entry.response) {
					if (part.kind === 'markdownContent') {
						responseText += part.content.value;
					}
				}
				if (responseText) {
					messages.push({ role: ChatMessageRole.Assistant, content: [{ type: 'text', value: responseText }] });
				}
			}
		}

		const userMessage = request.message + '\n\n[CRITICAL REMINDER: Use <TOOL_CALL> for actions!]';
		messages.push({ role: ChatMessageRole.User, content: [{ type: 'text', value: userMessage }] });

		let turns = 0;
		const maxTurns = 15;
		let finalError: unknown;
		const modelId = modelPlan[0] || 'auto';

		while (turns < maxTurns) {
			turns++;
			try {
				const response = await this.languageModelsService.sendChatRequest(modelId, undefined, messages, {}, token);
				let responseText = '';

				let filteredUIContent = '';
				let inTag = false;
				let tagBuffer = '';

				for await (const chunk of response.stream) {
					if (token.isCancellationRequested) { return {}; }
					const parts = Array.isArray(chunk) ? chunk : [chunk];
					for (const part of parts) {
						if (part.type === 'text') {
							responseText += part.value;

							// Streaming Filter: Hide <TAG>...</TAG> from UI
							for (const char of part.value) {
								if (char === '<') {
									inTag = true;
									tagBuffer = '<';
									continue;
								}

								if (inTag) {
									tagBuffer += char;
									// Check if it's a tag we want to hide
									const lowerBuffer = tagBuffer.toLowerCase();
									if (lowerBuffer.startsWith('<tool_call') ||
										lowerBuffer.startsWith('<create') ||
										lowerBuffer.startsWith('<edit') ||
										lowerBuffer.startsWith('<delete') ||
										lowerBuffer.startsWith('<thought') ||
										lowerBuffer.startsWith('</tool_call') ||
										lowerBuffer.startsWith('</create') ||
										lowerBuffer.startsWith('</edit') ||
										lowerBuffer.startsWith('</delete') ||
										lowerBuffer.startsWith('</thought')) {

										if (char === '>') {
											inTag = false;
											tagBuffer = '';
										}
										continue; // Skip this char for UI
									} else if (char === '>') {
										// Not a hidden tag, flush it
										filteredUIContent += tagBuffer;
										progress([{ kind: 'markdownContent', content: new MarkdownString(tagBuffer) }]);
										inTag = false;
										tagBuffer = '';
										continue;
									}
									// Still inside a potential hidden tag, wait to see if it closes or matches
									if (tagBuffer.length > 20) { // Safety: Not a tool tag
										filteredUIContent += tagBuffer;
										progress([{ kind: 'markdownContent', content: new MarkdownString(tagBuffer) }]);
										inTag = false;
										tagBuffer = '';
									}
									continue;
								}

								filteredUIContent += char;
								progress([{ kind: 'markdownContent', content: new MarkdownString(char) }]);
							}
						}
					}
				}

				const tools = parseToolCalls(responseText);
				if (tools.length > 0) {
					messages.push({ role: ChatMessageRole.Assistant, content: [{ type: 'text', value: responseText }] });
					progress([{ kind: 'progressMessage', content: new MarkdownString(`Executing tools...`) }]);

					for (const tool of tools) {
						const registeredTool = shadowAITools.find(t => t.name === tool.name);
						let toolResult = '';
						if (registeredTool) {
							toolResult = await registeredTool.execute(tool.args, {
								fileService: this.fileService,
								workspaceContextService: this.workspaceContextService
							});
						} else {
							toolResult = `Error: Tool '${tool.name}' not found.`;
						}
						messages.push({ role: ChatMessageRole.System, content: [{ type: 'text', value: `[Tool Result for ${tool.name}]\n${toolResult}` }] });
						const shortResult = toolResult.length > 200 ? toolResult.substring(0, 200) + '...' : toolResult;
						progress([{ kind: 'markdownContent', content: new MarkdownString(`\n> ✅ **${tool.name}**: ${shortResult}\n\n`) }]);

						// Auto-open created/edited files in the editor
						if ((tool.name === 'create_file' || tool.name === 'edit_file') && tool.args.path) {
							try {
								const workspace = this.workspaceContextService.getWorkspace();
								const folder = workspace.folders?.[0];
								if (folder) {
									const fileUri = URI.joinPath(folder.uri, tool.args.path);
									await this.editorService.openEditor({ resource: fileUri });
								}
							} catch { /* ignore open failures */ }
						}
					}
					continue;
				}
				return {};
			} catch (error: unknown) {
				finalError = error;
				break;
			}
		}

		if (finalError) {
			const errorMessage = sanitizeShadowAIErrorMessage(finalError instanceof Error ? finalError.message : String(finalError));
			progress([{ kind: 'markdownContent', content: new MarkdownString(`\n*Error during agent loop: ${errorMessage}*`) }]);
		}
		return {};
	}

	private async buildWorkspacePrompt(query: string, token: CancellationToken): Promise<string | undefined> {
		const workspace = this.workspaceContextService.getWorkspace();
		if (!workspace.folders || workspace.folders.length === 0) { return undefined; }
		const candidates = await this.collectWorkspaceFiles(workspace.folders, token);
		if (candidates.length === 0) { return undefined; }
		const queryTokens = this.extractQueryTokens(query);
		if (queryTokens.length === 0) { return undefined; }

		const rankedCandidates = this.rankCandidates(candidates, queryTokens);
		const treePreview = rankedCandidates.slice(0, ShadowChatAgent.WORKSPACE_TREE_PREVIEW_COUNT).map(c => c.displayPath).join('\n');

		const parts: string[] = ['Workspace snapshot:'];
		parts.push(treePreview);
		return parts.join('\n\n');
	}

	private _constitutionCache: string | undefined | null = null;
	private async loadProjectConstitution(): Promise<string | undefined> {
		if (this._constitutionCache !== null) { return this._constitutionCache; }
		const workspace = this.workspaceContextService.getWorkspace();
		const folder = workspace.folders?.[0];
		if (!folder) { this._constitutionCache = undefined; return undefined; }

		const constitutionUri = URI.joinPath(folder.uri, '.shadowcode', 'AGENT_CONSTITUTION.md');
		try {
			const file = await this.fileService.readFile(constitutionUri);
			this._constitutionCache = `## Project Constitution\n\n${file.value.toString()}`;
		} catch {
			this._constitutionCache = undefined;
		}
		return this._constitutionCache;
	}

	private async getActiveFilePrompt(): Promise<string | undefined> {
		const activeEditor = this.editorService.activeEditor;
		if (!activeEditor || !activeEditor.resource) { return undefined; }
		try {
			const content = await this.fileService.readFile(activeEditor.resource, { length: ShadowChatAgent.WORKSPACE_SNIPPET_BYTES });
			return `ACTIVE FILE: ${activeEditor.resource.fsPath}\n${content.value.toString().slice(0, ShadowChatAgent.WORKSPACE_SNIPPET_CHARS)}`;
		} catch { return undefined; }
	}

	private async collectWorkspaceFiles(folders: readonly IWorkspaceFolder[], token: CancellationToken): Promise<IShadowAIWorkspaceFileCandidate[]> {
		const collected: IShadowAIWorkspaceFileCandidate[] = [];
		const queue: Array<{ resource: URI; depth: number }> = folders.map(f => ({ resource: f.uri, depth: 0 }));

		while (queue.length > 0 && collected.length < ShadowChatAgent.WORKSPACE_MAX_FILES) {
			const entry = queue.shift()!;
			try {
				const stat = await this.fileService.resolve(entry.resource);
				if (stat.isDirectory && stat.children) {
					for (const child of stat.children) {
						if (child.isDirectory && entry.depth < ShadowChatAgent.WORKSPACE_MAX_DEPTH && !ShadowChatAgent.SKIPPED_FOLDERS.has(child.name.toLowerCase())) {
							queue.push({ resource: child.resource, depth: entry.depth + 1 });
						} else if (child.isFile && this.isLikelyTextFile(child.name)) {
							collected.push({ resource: child.resource, displayPath: child.name });
						}
					}
				}
			} catch { continue; }
		}
		return collected;
	}

	private isLikelyTextFile(name: string): boolean {
		return ShadowChatAgent.TEXT_FILE_EXTENSIONS.has(name.slice(name.lastIndexOf('.')).toLowerCase());
	}

	private extractQueryTokens(query: string): string[] {
		return query.toLowerCase().split(/[^a-z0-9_\-.]+/g).filter(t => t.length > 3 && !ShadowChatAgent.COMMON_STOP_WORDS.has(t)).slice(0, 10);
	}

	private rankCandidates(candidates: readonly IShadowAIWorkspaceFileCandidate[], queryTokens: string[]): IShadowAIWorkspaceFileCandidate[] {
		return [...candidates].sort((a, b) => {
			const aScore = queryTokens.filter(t => a.displayPath.toLowerCase().includes(t)).length;
			const bScore = queryTokens.filter(t => b.displayPath.toLowerCase().includes(t)).length;
			return bScore - aScore;
		});
	}
}
