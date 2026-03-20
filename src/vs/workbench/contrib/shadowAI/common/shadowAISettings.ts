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
		[ShadowAIConfiguration.DefaultModel]: {
			type: 'string',
			default: 'codellama',
			description: localize('shadowAI.defaultModel', "The default model to use for Shadow AI features."),
			scope: ConfigurationScope.RESOURCE
		}
	}
});
