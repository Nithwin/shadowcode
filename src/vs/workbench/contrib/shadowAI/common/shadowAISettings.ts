/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
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
	DefaultModel: 'shadowAI.defaultModel',
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
			default: ['llama-3.1-8b-instant', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
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
			default: ['meta-llama/llama-3.1-8b-instruct:free', 'mistralai/mistral-7b-instruct:free', 'qwen/qwen-2.5-7b-instruct:free'],
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
		[ShadowAIConfiguration.DefaultModel]: {
			type: 'string',
			default: 'codellama',
			description: localize('shadowAI.defaultModel', "The default model to use for Shadow AI features."),
			scope: ConfigurationScope.RESOURCE
		}
	}
});
