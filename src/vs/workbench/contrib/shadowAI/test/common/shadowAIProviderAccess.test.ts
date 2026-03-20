/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { isShadowAICloudProviderBlocked, isShadowAIOfflineLockEnabled, isShadowAIProviderEnabled } from '../../common/shadowAIProviderAccess.js';
import { ShadowAIConfiguration } from '../../common/shadowAISettings.js';

function configuration(values: Record<string, unknown>): IConfigurationService {
	return {
		getValue: <T>(arg1?: string): T => {
			if (!arg1) {
				return undefined as T;
			}
			return values[arg1] as T;
		}
	} as IConfigurationService;
}

suite('ShadowAIProviderAccess', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('provider enabled when present in enabledProviders', () => {
		const config = configuration({
			[ShadowAIConfiguration.EnabledProviders]: ['ollama', 'groq']
		});

		assert.deepStrictEqual({
			ollama: isShadowAIProviderEnabled(config, 'ollama'),
			huggingface: isShadowAIProviderEnabled(config, 'huggingface')
		}, {
			ollama: true,
			huggingface: false
		});
	});

	test('offline lock blocks cloud providers', () => {
		const config = configuration({
			[ShadowAIConfiguration.EnabledProviders]: ['ollama', 'openrouter'],
			[ShadowAIConfiguration.OfflineLock]: true
		});

		assert.deepStrictEqual({
			offline: isShadowAIOfflineLockEnabled(config),
			openrouterBlocked: isShadowAICloudProviderBlocked(config, 'openrouter')
		}, {
			offline: true,
			openrouterBlocked: true
		});
	});

	test('disabled cloud provider is blocked even when offline lock is false', () => {
		const config = configuration({
			[ShadowAIConfiguration.EnabledProviders]: ['ollama'],
			[ShadowAIConfiguration.OfflineLock]: false
		});

		assert.deepStrictEqual(isShadowAICloudProviderBlocked(config, 'groq'), true);
	});
});
