/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILanguageModelsService, IChatMessage, ChatMessageRole } from '../../chat/common/languageModels.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { localize2 } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { ShadowAIConfiguration } from '../common/shadowAISettings.js';
import { OllamaLanguageModelProvider } from './ollamaProvider.js';
import { GroqLanguageModelProvider } from './groqProvider.js';
import { OpenRouterLanguageModelProvider } from './openRouterProvider.js';
import { HuggingFaceLanguageModelProvider } from './huggingFaceProvider.js';
import { CustomOpenAILanguageModelProvider } from './customOpenAIProvider.js';
import { IChatAgentService, IChatAgentImplementation, IChatAgentRequest, IChatAgentResult, IChatAgentHistoryEntry } from '../../chat/common/participants/chatAgents.js';
import { IChatProgress } from '../../chat/common/chatService/chatService.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ChatAgentLocation, ChatModeKind } from '../../chat/common/constants.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { ChatContextKeys } from '../../chat/common/actions/chatContextKeys.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { sanitizeShadowAIErrorMessage } from '../common/shadowAIRedaction.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { createShadowArtifactBlueprint, ShadowArtifactKind } from '../common/shadowArtifactBlueprint.js';
import { analyzeShadowTerminalOutput } from '../common/shadowTerminalInsight.js';
import { buildShadowAITaskPlan } from '../common/shadowAITaskRouter.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { BrowserViewCommandId } from '../../../../platform/browserView/common/browserView.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { addShadowAIMemoryEntry, buildShadowAIMemoryPrompt, parseShadowAIMemoryState, serializeShadowAIMemoryState, SHADOW_AI_MEMORY_STORAGE_KEY } from '../common/shadowAIMemory.js';
import { buildShadowAIModelPlan, shouldFallbackToNextModel } from '../common/shadowAIModelPlan.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';

export class ShadowChatAgent implements IChatAgentImplementation {

	constructor(
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IStorageService private readonly storageService: IStorageService
	) { }

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
		if (modelPlan.length === 0) {
			progress([{ kind: 'markdownContent', content: new MarkdownString('No language model available. Please configure your model settings.') }]);
			return {};
		}

		progress([{ kind: 'progressMessage', content: new MarkdownString('Generating...') }]);

		const messages: IChatMessage[] = [];
		const memoryState = parseShadowAIMemoryState(this.storageService.get(SHADOW_AI_MEMORY_STORAGE_KEY, StorageScope.WORKSPACE));
		const memoryPrompt = buildShadowAIMemoryPrompt(memoryState, 6);
		if (memoryPrompt) {
			messages.push({ role: ChatMessageRole.System, content: [{ type: 'text', value: memoryPrompt }] });
		}

		for (const entry of history) {
			if (entry.request) {
				messages.push({ role: ChatMessageRole.User, content: [{ type: 'text', value: entry.request.message }] });
			}
			// Quick extraction of assistant responses from parts
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
		messages.push({ role: ChatMessageRole.User, content: [{ type: 'text', value: request.message }] });

		const autoFallback = this.configurationService.getValue<boolean>(ShadowAIConfiguration.AutoModelFallback) !== false;
		let finalError: unknown;

		for (let index = 0; index < modelPlan.length; index++) {
			const modelId = modelPlan[index];
			let emittedText = false;

			try {
				const response = await this.languageModelsService.sendChatRequest(modelId, undefined, messages, {}, token);
				for await (const chunk of response.stream) {
					if (Array.isArray(chunk)) {
						for (const c of chunk) {
							if (c.type === 'text') {
								emittedText = true;
								progress([{ kind: 'markdownContent', content: new MarkdownString(c.value) }]);
							}
						}
					} else if (chunk.type === 'text') {
						emittedText = true;
						progress([{ kind: 'markdownContent', content: new MarkdownString(chunk.value) }]);
					}
				}
				return {};
			} catch (error: unknown) {
				finalError = error;
				const canRetry = autoFallback && !emittedText && index < modelPlan.length - 1 && shouldFallbackToNextModel(error);
				if (canRetry) {
					continue;
				}
				break;
			}
		}

		const errorMessage = sanitizeShadowAIErrorMessage(finalError instanceof Error ? finalError.message : String(finalError));
		progress([{ kind: 'markdownContent', content: new MarkdownString(`*Error: ${errorMessage}*`) }]);

		return {};
	}
}

export class ShadowAIContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@ILanguageModelsService languageModelsService: ILanguageModelsService,
		@IChatAgentService chatAgentService: IChatAgentService
	) {
		super();

		// Register Language Model Providers
		const ollamaProvider = instantiationService.createInstance(OllamaLanguageModelProvider);
		const groqProvider = instantiationService.createInstance(GroqLanguageModelProvider);
		const openRouterProvider = instantiationService.createInstance(OpenRouterLanguageModelProvider);
		const huggingFaceProvider = instantiationService.createInstance(HuggingFaceLanguageModelProvider);
		const customOpenAIProvider = instantiationService.createInstance(CustomOpenAILanguageModelProvider);

		// Register vendors first
		languageModelsService.deltaLanguageModelChatProviderDescriptors([
			{
				vendor: 'ollama',
				displayName: 'Ollama',
				configuration: undefined,
				managementCommand: undefined,
				when: undefined
			},
			{
				vendor: 'groq',
				displayName: 'Groq',
				configuration: undefined,
				managementCommand: undefined,
				when: undefined
			},
			{
				vendor: 'openrouter',
				displayName: 'OpenRouter',
				configuration: undefined,
				managementCommand: undefined,
				when: undefined
			},
			{
				vendor: 'huggingface',
				displayName: 'Hugging Face',
				configuration: undefined,
				managementCommand: undefined,
				when: undefined
			},
			{
				vendor: 'custom',
				displayName: 'Custom API',
				configuration: undefined,
				managementCommand: undefined,
				when: undefined
			}
		], []);

		this._register(languageModelsService.registerLanguageModelProvider('ollama', ollamaProvider));
		this._register(languageModelsService.registerLanguageModelProvider('groq', groqProvider));
		this._register(languageModelsService.registerLanguageModelProvider('openrouter', openRouterProvider));
		this._register(languageModelsService.registerLanguageModelProvider('huggingface', huggingFaceProvider));
		this._register(languageModelsService.registerLanguageModelProvider('custom', customOpenAIProvider));

		// Force the models to be resolved immediately to populate the model picker UI
		languageModelsService.selectLanguageModels({ vendor: 'ollama' }).catch(e => console.error(e));
		languageModelsService.selectLanguageModels({ vendor: 'groq' }).catch(e => console.error(e));
		languageModelsService.selectLanguageModels({ vendor: 'openrouter' }).catch(e => console.error(e));
		languageModelsService.selectLanguageModels({ vendor: 'huggingface' }).catch(e => console.error(e));
		languageModelsService.selectLanguageModels({ vendor: 'custom' }).catch(e => console.error(e));

		// Register Default Chat Agent
		const agentId = 'shadowcode.agent';
		this._register(chatAgentService.registerAgent(agentId, {
			id: agentId,
			name: 'ShadowCode',
			isDefault: true,
			isCore: true,
			locations: [ChatAgentLocation.Chat, ChatAgentLocation.EditorInline, ChatAgentLocation.Terminal, ChatAgentLocation.Notebook],
			modes: [ChatModeKind.Agent, ChatModeKind.Ask, ChatModeKind.Edit],
			slashCommands: [],
			disambiguation: [],
			metadata: {},
			extensionId: nullExtensionDescription.identifier,
			extensionVersion: undefined,
			extensionPublisherId: nullExtensionDescription.publisher,
			extensionDisplayName: nullExtensionDescription.name
		}));

		const agentImpl = instantiationService.createInstance(ShadowChatAgent);
		this._register(chatAgentService.registerAgentImplementation(agentId, agentImpl));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ShadowAIContribution, LifecyclePhase.Restored);


registerAction2(class OpenShadowAISettingsAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.openSettings',
			title: localize2('shadowAI.openSettings', "Shadow AI Settings"),
			icon: Codicon.settingsGear,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 1
			}
		});
	}

	run(accessor: ServicesAccessor) {
		const preferencesService = accessor.get(IPreferencesService);
		preferencesService.openSettings({ query: 'shadowAI' });
	}
});

registerAction2(class TestShadowAIProvidersAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.testProviders',
			title: localize2('shadowAI.testProviders', "Shadow AI: Test Providers"),
			icon: Codicon.beaker,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 2
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const languageModelsService = accessor.get(ILanguageModelsService);
		const notificationService = accessor.get(INotificationService);

		const vendors = ['ollama', 'groq', 'openrouter', 'huggingface', 'custom'];
		const results: string[] = [];
		let failedChecks = 0;
		let warningChecks = 0;

		for (const vendor of vendors) {
			try {
				const models = await languageModelsService.selectLanguageModels({ vendor });
				if (models.length === 0) {
					warningChecks++;
					results.push(`${vendor}: WARNING (0 models discovered)`);
				} else {
					results.push(`${vendor}: OK (${models.length} models)`);
				}
			} catch (error: unknown) {
				failedChecks++;
				results.push(`${vendor}: FAILED (${this.toErrorMessage(error)})`);
			}
		}

		if (failedChecks > 0) {
			notificationService.warn(`Shadow AI provider checks completed with ${failedChecks} failure(s): ${results.join(' | ')}`);
			return;
		}

		if (warningChecks > 0) {
			notificationService.warn(`Shadow AI provider checks completed with ${warningChecks} warning(s): ${results.join(' | ')}`);
			return;
		}

		notificationService.info(`Shadow AI provider checks passed: ${results.join(' | ')}`);
	}

	private toErrorMessage(error: unknown): string {
		if (error instanceof Error) {
			return sanitizeShadowAIErrorMessage(error.message);
		}

		return sanitizeShadowAIErrorMessage(String(error));
	}
});

registerAction2(class ShadowAIProviderDiagnosticsAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.providerDiagnostics',
			title: localize2('shadowAI.providerDiagnostics', "Shadow AI: Provider Diagnostics"),
			icon: Codicon.graph,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 3
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const languageModelsService = accessor.get(ILanguageModelsService);
		const notificationService = accessor.get(INotificationService);

		const vendors = [
			{ id: 'ollama', label: 'Ollama' },
			{ id: 'groq', label: 'Groq' },
			{ id: 'openrouter', label: 'OpenRouter' },
			{ id: 'huggingface', label: 'Hugging Face' },
			{ id: 'custom', label: 'Custom API' }
		];

		const diagnostics: string[] = [];
		let failedChecks = 0;
		let warningChecks = 0;

		for (const vendor of vendors) {
			const startedAt = Date.now();
			try {
				const models = await languageModelsService.selectLanguageModels({ vendor: vendor.id });
				const elapsedMs = Date.now() - startedAt;
				if (models.length === 0) {
					warningChecks++;
					diagnostics.push(`${vendor.label}: WARNING (0 models, ${elapsedMs}ms)`);
				} else {
					diagnostics.push(`${vendor.label}: OK (${models.length} models, ${elapsedMs}ms)`);
				}
			} catch (error: unknown) {
				const elapsedMs = Date.now() - startedAt;
				failedChecks++;
				diagnostics.push(`${vendor.label}: FAILED (${this.toErrorMessage(error)}, ${elapsedMs}ms)`);
			}
		}

		const details = diagnostics.join(' | ');
		if (failedChecks > 0) {
			notificationService.warn(`Shadow AI provider diagnostics found ${failedChecks} failure(s): ${details}`);
			return;
		}

		if (warningChecks > 0) {
			notificationService.warn(`Shadow AI provider diagnostics found ${warningChecks} warning(s): ${details}`);
			return;
		}

		notificationService.info(`Shadow AI provider diagnostics passed: ${details}`);
	}

	private toErrorMessage(error: unknown): string {
		if (error instanceof Error) {
			return sanitizeShadowAIErrorMessage(error.message);
		}

		return sanitizeShadowAIErrorMessage(String(error));
	}
});

registerAction2(class ToggleShadowAIOfflineLockAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.toggleOfflineLock',
			title: localize2('shadowAI.toggleOfflineLock', "Shadow AI: Toggle Offline Lock"),
			icon: Codicon.lock,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 4
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);

		const current = configurationService.getValue<boolean>(ShadowAIConfiguration.OfflineLock);
		const next = !current;
		await configurationService.updateValue(ShadowAIConfiguration.OfflineLock, next, ConfigurationTarget.USER_LOCAL);

		notificationService.info(next
			? 'Shadow AI offline lock enabled. Cloud providers are disabled.'
			: 'Shadow AI offline lock disabled. Cloud providers are enabled.');
	}
});

registerAction2(class GenerateShadowAIArtifactBlueprintAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.generateArtifactBlueprint',
			title: localize2('shadowAI.generateArtifactBlueprint', "Shadow AI: Generate Artifact Blueprint"),
			icon: Codicon.symbolFile,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 5
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const clipboardService = accessor.get(IClipboardService);
		const notificationService = accessor.get(INotificationService);

		const pick = await quickInputService.pick([
			{ label: 'Presentation (PPT)', id: 'presentation' as ShadowArtifactKind },
			{ label: 'Document (DOC)', id: 'document' as ShadowArtifactKind },
			{ label: 'Spreadsheet (XLS)', id: 'spreadsheet' as ShadowArtifactKind }
		], {
			placeHolder: 'Select artifact type'
		});

		if (!pick) {
			return;
		}

		const prompt = await quickInputService.input({
			prompt: 'Describe what you want to create',
			placeHolder: 'e.g. Product launch deck for Q3'
		});

		if (!prompt) {
			return;
		}

		const blueprint = createShadowArtifactBlueprint(pick.id, prompt);
		const plan = buildShadowAITaskPlan(prompt);
		await clipboardService.writeText(blueprint);

		notificationService.info(`Blueprint copied to clipboard using ${plan.taskKind} workflow (${plan.steps.length} agents).`);
	}
});

registerAction2(class AnalyzeShadowAITerminalOutputAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.analyzeTerminalOutput',
			title: localize2('shadowAI.analyzeTerminalOutput', "Shadow AI: Analyze Terminal Output"),
			icon: Codicon.terminal,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 6
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);

		const output = await quickInputService.input({
			prompt: 'Paste command output or error text',
			placeHolder: 'stderr/stdout excerpt'
		});

		if (!output) {
			return;
		}

		const insight = analyzeShadowTerminalOutput(output);
		notificationService.info(`Terminal Insight: ${insight.summary} Next: ${insight.suggestedNextCommand}`);
	}
});

registerAction2(class ShadowAIBrowserAgentOpenAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.browserAgent.open',
			title: localize2('shadowAI.browserAgent.open', "Shadow AI Browser Agent: Open Page"),
			icon: Codicon.globe,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 7
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const commandService = accessor.get(ICommandService);
		const notificationService = accessor.get(INotificationService);

		const rawUrl = await quickInputService.input({
			prompt: 'Enter URL to open in AI browser',
			placeHolder: 'https://example.com'
		});

		if (!rawUrl) {
			return;
		}

		const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
		await commandService.executeCommand(BrowserViewCommandId.Open, { url: normalizedUrl });
		notificationService.info(`AI Browser Agent opened ${normalizedUrl}`);
	}
});

registerAction2(class ShadowAIBrowserAgentCaptureConsoleAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.browserAgent.captureConsole',
			title: localize2('shadowAI.browserAgent.captureConsole', "Shadow AI Browser Agent: Add Console Logs to Chat"),
			icon: Codicon.output,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 8
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		const notificationService = accessor.get(INotificationService);

		await commandService.executeCommand(BrowserViewCommandId.AddConsoleLogsToChat);
		notificationService.info('Browser console logs were added to chat context.');
	}
});

registerAction2(class ShadowAIBrowserAgentDebugModeAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.browserAgent.toggleDevTools',
			title: localize2('shadowAI.browserAgent.toggleDevTools', "Shadow AI Browser Agent: Toggle Browser DevTools"),
			icon: Codicon.tools,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 9
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand(BrowserViewCommandId.ToggleDevTools);
	}
});

registerAction2(class AddShadowAIProjectMemoryAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.memory.addProjectNote',
			title: localize2('shadowAI.memory.addProjectNote', "Shadow AI Memory: Add Project Note"),
			icon: Codicon.bookmark,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 10
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const storageService = accessor.get(IStorageService);
		const notificationService = accessor.get(INotificationService);

		const text = await quickInputService.input({
			prompt: 'Add project memory note',
			placeHolder: 'e.g. Prefer local provider for all coding tasks'
		});

		if (!text) {
			return;
		}

		const state = parseShadowAIMemoryState(storageService.get(SHADOW_AI_MEMORY_STORAGE_KEY, StorageScope.WORKSPACE));
		const next = addShadowAIMemoryEntry(state, 'project', text);
		storageService.store(SHADOW_AI_MEMORY_STORAGE_KEY, serializeShadowAIMemoryState(next), StorageScope.WORKSPACE, StorageTarget.USER);
		notificationService.info('Project memory note added.');
	}
});

registerAction2(class AddShadowAIChatMemoryAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.memory.addChatNote',
			title: localize2('shadowAI.memory.addChatNote', "Shadow AI Memory: Add Chat Note"),
			icon: Codicon.comment,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 11
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const storageService = accessor.get(IStorageService);
		const notificationService = accessor.get(INotificationService);

		const text = await quickInputService.input({
			prompt: 'Add chat memory note',
			placeHolder: 'e.g. Continue implementation without asking for a plan'
		});

		if (!text) {
			return;
		}

		const state = parseShadowAIMemoryState(storageService.get(SHADOW_AI_MEMORY_STORAGE_KEY, StorageScope.WORKSPACE));
		const next = addShadowAIMemoryEntry(state, 'chat', text);
		storageService.store(SHADOW_AI_MEMORY_STORAGE_KEY, serializeShadowAIMemoryState(next), StorageScope.WORKSPACE, StorageTarget.USER);
		notificationService.info('Chat memory note added.');
	}
});

registerAction2(class ShowShadowAIMemoryContextAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.memory.showContext',
			title: localize2('shadowAI.memory.showContext', "Shadow AI Memory: Show Context Summary"),
			icon: Codicon.listTree,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 12
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const storageService = accessor.get(IStorageService);
		const clipboardService = accessor.get(IClipboardService);
		const notificationService = accessor.get(INotificationService);

		const state = parseShadowAIMemoryState(storageService.get(SHADOW_AI_MEMORY_STORAGE_KEY, StorageScope.WORKSPACE));
		const summary = buildShadowAIMemoryPrompt(state, 10);
		if (!summary) {
			notificationService.info('Shadow AI memory is empty.');
			return;
		}

		await clipboardService.writeText(summary);
		notificationService.info('Shadow AI memory summary copied to clipboard.');
	}
});

registerAction2(class ListShadowAIProviderModelsAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.listProviderModels',
			title: localize2('shadowAI.listProviderModels', "Shadow AI: List Provider Models"),
			icon: Codicon.symbolString,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 13
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const languageModelsService = accessor.get(ILanguageModelsService);
		const clipboardService = accessor.get(IClipboardService);
		const notificationService = accessor.get(INotificationService);

		const modelIds = languageModelsService.getLanguageModelIds();
		if (modelIds.length === 0) {
			notificationService.warn('No models are currently available.');
			return;
		}

		const byProvider = new Map<string, string[]>();
		for (const modelId of modelIds) {
			const separator = modelId.indexOf(':');
			const provider = separator > -1 ? modelId.slice(0, separator) : 'unknown';
			const model = separator > -1 ? modelId.slice(separator + 1) : modelId;
			const bucket = byProvider.get(provider) || [];
			bucket.push(model);
			byProvider.set(provider, bucket);
		}

		const lines: string[] = [];
		for (const [provider, models] of byProvider) {
			lines.push(`${provider}: ${models.join(', ')}`);
		}

		await clipboardService.writeText(lines.join('\n'));
		notificationService.info('Provider model list copied to clipboard.');
	}
});

registerAction2(class OpenShadowAIAgentMarketplaceAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.openAgentMarketplace',
			title: localize2('shadowAI.openAgentMarketplace', "Shadow AI: Open Agent Marketplace"),
			icon: Codicon.extensions,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 14
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const openerService = accessor.get(IOpenerService);
		const marketplaceUrl = configurationService.getValue<string>(ShadowAIConfiguration.AgentMarketplaceUrl) || 'https://open-vsx.org/?q=shadowcode+agent';
		await openerService.open(marketplaceUrl, { openExternal: true });
	}
});

registerAction2(class ShadowAIWorkflowBootstrapAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.workflowBootstrap',
			title: localize2('shadowAI.workflowBootstrap', "Shadow AI: Workflow Bootstrap"),
			icon: Codicon.rocket,
			f1: true,
			precondition: ChatContextKeys.enabled,
			menu: {
				id: MenuId.ChatViewSessionTitleToolbar,
				group: 'navigation',
				order: 15
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const languageModelsService = accessor.get(ILanguageModelsService);
		const configurationService = accessor.get(IConfigurationService);
		const storageService = accessor.get(IStorageService);
		const notificationService = accessor.get(INotificationService);

		const providers = ['ollama', 'groq', 'openrouter', 'huggingface', 'custom'];
		const providerResults: string[] = [];
		for (const provider of providers) {
			const models = await languageModelsService.selectLanguageModels({ vendor: provider });
			providerResults.push(`${provider}:${models.length}`);
		}

		const modelCount = languageModelsService.getLanguageModelIds().length;
		const workflowProfile = configurationService.getValue<string>(ShadowAIConfiguration.WorkflowProfile) || 'balanced';
		const memoryState = parseShadowAIMemoryState(storageService.get(SHADOW_AI_MEMORY_STORAGE_KEY, StorageScope.WORKSPACE));
		const memoryCount = memoryState.project.length + memoryState.chat.length;

		notificationService.info(`Bootstrap complete | profile=${workflowProfile} | models=${modelCount} | memory=${memoryCount} | providers=[${providerResults.join(', ')}]`);
	}
});
