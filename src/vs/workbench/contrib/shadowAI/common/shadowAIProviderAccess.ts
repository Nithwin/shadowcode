/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ShadowAIConfiguration } from './shadowAISettings.js';

export type ShadowAIProviderId = 'ollama' | 'groq' | 'openrouter' | 'huggingface' | 'custom';

export function isShadowAIProviderEnabled(configurationService: IConfigurationService, provider: ShadowAIProviderId): boolean {
	const enabledProviders = configurationService.getValue<string[]>(ShadowAIConfiguration.EnabledProviders) || [];
	if (enabledProviders.length === 0) {
		return false;
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
