/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService, ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { ShadowAIConfiguration } from './shadowAISettings.js';

export type ShadowAICloudProvider = 'groq' | 'openrouter' | 'huggingface' | 'custom';

const secretPrefix = 'shadowAI.apiKey.';

function getApiKeySetting(provider: ShadowAICloudProvider): string {
	switch (provider) {
		case 'groq': return ShadowAIConfiguration.GroqApiKey;
		case 'openrouter': return ShadowAIConfiguration.OpenRouterApiKey;
		case 'huggingface': return ShadowAIConfiguration.HuggingFaceApiKey;
		case 'custom': return ShadowAIConfiguration.CustomApiKey;
	}
}

function getSecretKey(provider: ShadowAICloudProvider): string {
	return `${secretPrefix}${provider}`;
}

/**
 * Resolve provider API key from secure storage. If missing, migrate the plaintext setting value
 * into secure storage and attempt to clear the plaintext setting.
 */
export async function resolveShadowAIApiKey(
	provider: ShadowAICloudProvider,
	configurationService: IConfigurationService,
	secretStorageService: ISecretStorageService,
	logService: ILogService
): Promise<string | undefined> {
	const secretKey = getSecretKey(provider);
	const fromSecretStorage = await secretStorageService.get(secretKey);
	if (fromSecretStorage && fromSecretStorage.trim().length > 0) {
		return fromSecretStorage;
	}

	const settingKey = getApiKeySetting(provider);
	const fromSettings = configurationService.getValue<string>(settingKey);
	if (!fromSettings || fromSettings.trim().length === 0) {
		return undefined;
	}

	await secretStorageService.set(secretKey, fromSettings);

	// Best-effort cleanup of plaintext API keys from settings.
	try {
		await configurationService.updateValue(settingKey, '', ConfigurationTarget.USER_LOCAL);
	} catch (error) {
		logService.warn(`[ShadowAI] Failed to clear plaintext key for ${provider} in settings`, error);
	}

	return fromSettings;
}
