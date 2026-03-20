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
import '../common/shadowAISettings.js';
import { OllamaLanguageModelProvider } from './ollamaProvider.js';
import { GroqLanguageModelProvider } from './groqProvider.js';
import { IChatAgentService, IChatAgentImplementation, IChatAgentRequest, IChatAgentResult, IChatAgentHistoryEntry } from '../../chat/common/participants/chatAgents.js';
import { IChatProgress } from '../../chat/common/chatService/chatService.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ChatAgentLocation, ChatModeKind } from '../../chat/common/constants.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';

export class ShadowChatAgent implements IChatAgentImplementation {

	constructor(
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService
	) { }

	async invoke(request: IChatAgentRequest, progress: (parts: IChatProgress[]) => void, history: IChatAgentHistoryEntry[], token: CancellationToken): Promise<IChatAgentResult> {
		const modelId = request.userSelectedModelId || this.languageModelsService.getLanguageModelIds()[0];
		if (!modelId) {
			progress([{ kind: 'markdownContent', content: new MarkdownString('No language model available. Please configure your model settings.') }]);
			return {};
		}

		progress([{ kind: 'progressMessage', content: new MarkdownString('Generating...') }]);

		const messages: IChatMessage[] = [];
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

		try {
			const response = await this.languageModelsService.sendChatRequest(modelId, undefined, messages, {}, token);
			for await (const chunk of response.stream) {
				if (Array.isArray(chunk)) {
					for (const c of chunk) {
						if (c.type === 'text') {
							progress([{ kind: 'markdownContent', content: new MarkdownString(c.value) }]);
						}
					}
				} else if (chunk.type === 'text') {
					progress([{ kind: 'markdownContent', content: new MarkdownString(chunk.value) }]);
				}
			}
		} catch (e: any) {
			progress([{ kind: 'markdownContent', content: new MarkdownString(`*Error: ${e.message}*`) }]);
		}

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
			}
		], []);

		this._register(languageModelsService.registerLanguageModelProvider('ollama', ollamaProvider));
		this._register(languageModelsService.registerLanguageModelProvider('groq', groqProvider));

		// Force the models to be resolved immediately to populate the model picker UI
		languageModelsService.selectLanguageModels({ vendor: 'ollama' }).catch(e => console.error(e));
		languageModelsService.selectLanguageModels({ vendor: 'groq' }).catch(e => console.error(e));

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
