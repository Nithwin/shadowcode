/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILanguageModelsService } from '../../chat/common/languageModels.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { OllamaLanguageModelProvider } from './ollamaProvider.js';
import { GroqLanguageModelProvider } from './groqProvider.js';
import { OpenRouterLanguageModelProvider } from './openRouterProvider.js';
import { HuggingFaceLanguageModelProvider } from './huggingFaceProvider.js';
import { CustomOpenAILanguageModelProvider } from './customOpenAIProvider.js';
import { IChatAgentService } from '../../chat/common/participants/chatAgents.js';
import { ChatAgentLocation, ChatModeKind } from '../../chat/common/constants.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { ChatContextKeys } from '../../chat/common/actions/chatContextKeys.js';
import { ShadowChatAgent } from './shadowChatAgent.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize2 } from '../../../../nls.js';

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

		languageModelsService.deltaLanguageModelChatProviderDescriptors([
			{ vendor: 'ollama', displayName: 'Ollama', configuration: undefined, managementCommand: undefined, when: undefined },
			{ vendor: 'groq', displayName: 'Groq', configuration: undefined, managementCommand: undefined, when: undefined },
			{ vendor: 'openrouter', displayName: 'OpenRouter', configuration: undefined, managementCommand: undefined, when: undefined },
			{ vendor: 'huggingface', displayName: 'Hugging Face', configuration: undefined, managementCommand: undefined, when: undefined },
			{ vendor: 'custom', displayName: 'Custom API', configuration: undefined, managementCommand: undefined, when: undefined }
		], []);

		this._register(languageModelsService.registerLanguageModelProvider('ollama', ollamaProvider));
		this._register(languageModelsService.registerLanguageModelProvider('groq', groqProvider));
		this._register(languageModelsService.registerLanguageModelProvider('openrouter', openRouterProvider));
		this._register(languageModelsService.registerLanguageModelProvider('huggingface', huggingFaceProvider));
		this._register(languageModelsService.registerLanguageModelProvider('custom', customOpenAIProvider));

		// Register Default Chat Agent
		const agentId = 'shadowcode.agent';
		this._register(chatAgentService.registerAgent(agentId, {
			id: agentId,
			name: 'ShadowCode',
			isDefault: true,
			isCore: false,
			locations: [ChatAgentLocation.Chat, ChatAgentLocation.EditorInline, ChatAgentLocation.Terminal, ChatAgentLocation.Notebook],
			modes: [ChatModeKind.Agent, ChatModeKind.Ask, ChatModeKind.Edit],
			slashCommands: [],
			disambiguation: [],
			metadata: {},
			extensionId: new ExtensionIdentifier('shadowcode.ai'),
			extensionVersion: '1.0.0',
			extensionPublisherId: 'shadowcode',
			extensionDisplayName: 'ShadowCode AI'
		}));

		this._register(chatAgentService.registerAgentImplementation(agentId, instantiationService.createInstance(ShadowChatAgent)));
	}
}

// Keep only the most vital, non-obtrusive actions.
// Removed ALL ChatViewSessionTitleToolbar registrations to declutter the top bar.
registerAction2(class ShadowAIWorkflowStatusAction extends Action2 {
	constructor() {
		super({
			id: 'shadowAI.workflowStatus',
			title: localize2('shadowAI.workflowStatus', "Shadow AI: Agent Status"),
			icon: Codicon.rocket,
			f1: true,
			precondition: ChatContextKeys.enabled
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Shadow AI: Agentic Loop is active and modularized.');
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ShadowAIContribution, LifecyclePhase.Restored);
