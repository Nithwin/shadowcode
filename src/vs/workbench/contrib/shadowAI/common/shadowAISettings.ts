/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';

export const ShadowAIConfiguration = {
	OllamaEndpoint: 'shadowAI.ollamaEndpoint',
	GroqEndpoint: 'shadowAI.groqEndpoint',
	GroqApiKey: 'shadowAI.groqApiKey',
	GroqModels: 'shadowAI.groqModels',
	OpenRouterEndpoint: 'shadowAI.openRouterEndpoint',
	OpenRouterApiKey: 'shadowAI.openRouterApiKey',
	OpenRouterModels: 'shadowAI.openRouterModels',
	HuggingFaceEndpoint: 'shadowAI.huggingFaceEndpoint',
	HuggingFaceApiKey: 'shadowAI.huggingFaceApiKey',
	HuggingFaceModels: 'shadowAI.huggingFaceModels',
	CustomEndpoint: 'shadowAI.customEndpoint',
	CustomApiKey: 'shadowAI.customApiKey',
	CustomModels: 'shadowAI.customModels',
	OfflineLock: 'shadowAI.offlineLock',
	EnabledProviders: 'shadowAI.enabledProviders',
	ModelListCacheTtlMs: 'shadowAI.modelListCacheTtlMs',
	AutoModelFallback: 'shadowAI.autoModelFallback',
	MaxModelFallbackAttempts: 'shadowAI.maxModelFallbackAttempts',
	WorkflowProfile: 'shadowAI.workflowProfile',
	AgentMarketplaceUrl: 'shadowAI.agentMarketplaceUrl',
	ProviderPriority: 'shadowAI.providerPriority',
	DefaultModel: 'shadowAI.defaultModel',
	AutoApplyEdits: 'shadowAI.autoApplyEdits',
};

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'shadowAI',
	order: 100,
	title: localize('shadowAI', "Shadow AI"),
	type: 'object',
	properties: {
		[ShadowAIConfiguration.OllamaEndpoint]: {
			type: 'string',
			default: 'http://localhost:11434',
			description: localize('shadowAI.ollamaEndpoint', "The endpoint URL for the local Ollama instance."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.GroqEndpoint]: {
			type: 'string',
			default: 'https://api.groq.com/openai/v1',
			description: localize('shadowAI.groqEndpoint', "The endpoint URL for Groq's OpenAI-compatible API."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.GroqApiKey]: {
			type: 'string',
			default: '',
			description: localize('shadowAI.groqApiKey', "Groq API key used for cloud model requests."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.GroqModels]: {
			type: 'array',
			items: { type: 'string' },
			default: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
			description: localize('shadowAI.groqModels', "Groq models available in the Shadow AI provider switcher."),
			scope: ConfigurationScope.RESOURCE
		},
		[ShadowAIConfiguration.OpenRouterEndpoint]: {
			type: 'string',
			default: 'https://openrouter.ai/api/v1',
			description: localize('shadowAI.openRouterEndpoint', "The endpoint URL for OpenRouter's OpenAI-compatible API."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.OpenRouterApiKey]: {
			type: 'string',
			default: '',
			description: localize('shadowAI.openRouterApiKey', "OpenRouter API key used for cloud model requests."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.OpenRouterModels]: {
			type: 'array',
			items: { type: 'string' },
			default: ['openrouter/auto', 'meta-llama/llama-3.1-8b-instruct', 'mistralai/mistral-7b-instruct', 'google/gemma-2-9b-it'],
			description: localize('shadowAI.openRouterModels', "OpenRouter models available in the Shadow AI provider switcher."),
			scope: ConfigurationScope.RESOURCE
		},
		[ShadowAIConfiguration.HuggingFaceEndpoint]: {
			type: 'string',
			default: 'https://router.huggingface.co/v1',
			description: localize('shadowAI.huggingFaceEndpoint', "The endpoint URL for Hugging Face's OpenAI-compatible router."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.HuggingFaceApiKey]: {
			type: 'string',
			default: '',
			description: localize('shadowAI.huggingFaceApiKey', "Hugging Face API token used for cloud model requests."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.HuggingFaceModels]: {
			type: 'array',
			items: { type: 'string' },
			default: ['meta-llama/Llama-3.1-8B-Instruct', 'Qwen/Qwen2.5-Coder-7B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3'],
			description: localize('shadowAI.huggingFaceModels', "Hugging Face models available in the Shadow AI provider switcher."),
			scope: ConfigurationScope.RESOURCE
		},
		[ShadowAIConfiguration.CustomEndpoint]: {
			type: 'string',
			default: 'https://api.openai.com/v1',
			description: localize('shadowAI.customEndpoint', "A custom OpenAI-compatible endpoint URL for third-party providers."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.CustomApiKey]: {
			type: 'string',
			default: '',
			description: localize('shadowAI.customApiKey', "API key used for the custom OpenAI-compatible provider."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.CustomModels]: {
			type: 'array',
			items: { type: 'string' },
			default: [],
			description: localize('shadowAI.customModels', "Custom provider models available in the Shadow AI provider switcher."),
			scope: ConfigurationScope.RESOURCE
		},
		[ShadowAIConfiguration.OfflineLock]: {
			type: 'boolean',
			default: false,
			description: localize('shadowAI.offlineLock', "Force Shadow AI into local-only mode by disabling all cloud providers."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.EnabledProviders]: {
			type: 'array',
			items: { type: 'string' },
			default: ['ollama', 'openrouter', 'groq', 'huggingface', 'custom'],
			description: localize('shadowAI.enabledProviders', "List of enabled Shadow AI providers. Providers not in this list are disabled."),
			scope: ConfigurationScope.RESOURCE
		},
		[ShadowAIConfiguration.ModelListCacheTtlMs]: {
			type: 'number',
			default: 30000,
			minimum: 0,
			description: localize('shadowAI.modelListCacheTtlMs', "TTL for cached provider model lists in milliseconds. Set to 0 to disable model list caching."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.AutoModelFallback]: {
			type: 'boolean',
			default: true,
			description: localize('shadowAI.autoModelFallback', "Automatically fall back to the next available model when rate limits or provider capacity issues occur."),
			scope: ConfigurationScope.RESOURCE
		},
		[ShadowAIConfiguration.MaxModelFallbackAttempts]: {
			type: 'number',
			default: 4,
			minimum: 1,
			description: localize('shadowAI.maxModelFallbackAttempts', "Maximum number of model attempts for automatic fallback execution."),
			scope: ConfigurationScope.RESOURCE
		},
		[ShadowAIConfiguration.WorkflowProfile]: {
			type: 'string',
			enum: ['offline', 'balanced', 'cloud'],
			default: 'balanced',
			description: localize('shadowAI.workflowProfile', "Workflow profile preset for routing and fallback behavior."),
			scope: ConfigurationScope.RESOURCE
		},
		[ShadowAIConfiguration.AgentMarketplaceUrl]: {
			type: 'string',
			default: 'https://open-vsx.org/?q=shadowcode+agent',
			description: localize('shadowAI.agentMarketplaceUrl', "Marketplace URL used by Shadow AI agent marketplace command."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.ProviderPriority]: {
			type: 'array',
			items: { type: 'string' },
			default: ['ollama', 'openrouter', 'groq', 'huggingface', 'custom'],
			description: localize('shadowAI.providerPriority', "Preferred provider order used when selecting fallback models automatically."),
			scope: ConfigurationScope.RESOURCE
		},
		[ShadowAIConfiguration.DefaultModel]: {
			type: 'string',
			default: 'auto',
			description: localize('shadowAI.defaultModel', "The default model ID to use when a new chat session starts. If 'auto', the first available provider will be selected."),
			scope: ConfigurationScope.MACHINE
		},
		[ShadowAIConfiguration.AutoApplyEdits]: {
			type: 'boolean',
			default: true,
			description: localize('shadowAI.autoApplyEdits', "Enable Optimistic Editing. When the AI proposes an edit or creates a new file, it will automatically save to disk and open the file, bypassing the 'Apply' button in the chat view."),
			scope: ConfigurationScope.MACHINE
		}
	}
});
