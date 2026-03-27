/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ShadowAIConfiguration } from './shadowAISettings.js';

export type ShadowAIProviderId = 'ollama' | 'groq' | 'openrouter' | 'huggingface' | 'custom';

const defaultEnabledProviders: readonly ShadowAIProviderId[] = ['ollama', 'groq', 'openrouter', 'huggingface', 'custom'];

export function isShadowAIProviderEnabled(configurationService: IConfigurationService, provider: ShadowAIProviderId): boolean {
	const configuredProviders = configurationService.getValue<string[]>(ShadowAIConfiguration.EnabledProviders);
	if (!configuredProviders || configuredProviders.length === 0) {
		return defaultEnabledProviders.includes(provider);
	}

	const enabledProviders: string[] = [];
	for (const configuredProvider of configuredProviders) {
		if (typeof configuredProvider === 'string') {
			enabledProviders.push(configuredProvider.toLowerCase());
		}
	}

	return enabledProviders.includes(provider);
}

export function isShadowAIOfflineLockEnabled(configurationService: IConfigurationService): boolean {
	return !!configurationService.getValue<boolean>(ShadowAIConfiguration.OfflineLock);
}

export function isShadowAICloudProviderBlocked(configurationService: IConfigurationService, provider: Exclude<ShadowAIProviderId, 'ollama'>): boolean {
	if (!isShadowAIProviderEnabled(configurationService, provider)) {
		return true;
	}

	return isShadowAIOfflineLockEnabled(configurationService);
}
