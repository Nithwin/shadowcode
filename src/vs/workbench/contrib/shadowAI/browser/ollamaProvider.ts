/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IDisposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';
import { ILanguageModelChatProvider, IChatMessage, ILanguageModelChatRequestOptions, ILanguageModelChatResponse, IChatResponsePart, ChatMessageRole, ILanguageModelChatMetadataAndIdentifier, ILanguageModelChatInfoOptions } from '../../chat/common/languageModels.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { ShadowAIConfiguration } from '../common/shadowAISettings.js';
import { IOllamaTagsResponse, IOllamaChatResponseDelta, IOllamaChatRequest, IOllamaModel } from '../common/ollamaTypes.js';
import { isShadowAIProviderEnabled } from '../common/shadowAIProviderAccess.js';
import { ShadowAIModelCache } from '../common/shadowAIModelCache.js';

import { AsyncIterableSource } from '../../../../base/common/async.js';
import { listenStream } from '../../../../base/common/stream.js';

export class OllamaLanguageModelProvider implements ILanguageModelChatProvider, IDisposable {

	private readonly _onDidChange = new Emitter<void>();
	readonly onDidChange: Event<void> = this._onDidChange.event;

	private readonly _store = new DisposableStore();
	private readonly _modelInfoCache = new ShadowAIModelCache<ILanguageModelChatMetadataAndIdentifier[]>();

	constructor(
		@IRequestService private readonly _requestService: IRequestService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ILogService private readonly _logService: ILogService,
	) { }

	dispose(): void {
		this._store.dispose();
		this._onDidChange.dispose();
	}

	async provideLanguageModelChatInfo(options: ILanguageModelChatInfoOptions, token: CancellationToken): Promise<ILanguageModelChatMetadataAndIdentifier[]> {
		if (!isShadowAIProviderEnabled(this._configurationService, 'ollama')) {
			return [];
		}

		const endpoint = this._configurationService.getValue<string>(ShadowAIConfiguration.OllamaEndpoint);
		const ttlMs = this._configurationService.getValue<number>(ShadowAIConfiguration.ModelListCacheTtlMs) ?? 30000;
		const cacheKey = `endpoint=${endpoint}`;

		return this._modelInfoCache.getOrCompute(cacheKey, ttlMs, async () => {
			try {
				const context = await this._requestService.request({
					url: `${endpoint}/api/tags`,
					type: 'GET',
					callSite: 'ollama'
				}, token);

				if (context.res.statusCode !== 200) {
					this._logService.error('[Ollama] Failed to fetch models', context.res.statusCode);
					return [];
				}

				const tags = await asJson<IOllamaTagsResponse>(context);
				if (!tags || !tags.models) {
					return [];
				}

				return tags.models.map((m: IOllamaModel) => ({
					identifier: `ollama:${m.name}`,
					metadata: {
						extension: new ExtensionIdentifier('shadowcode.ollama'),
						name: m.name,
						id: `ollama:${m.name}`,
						vendor: 'ollama',
						version: m.details.parameter_size || 'latest',
						family: m.details.family || 'ollama',
						maxInputTokens: 4096, // Ollama default
						maxOutputTokens: 4096,
						isDefaultForLocation: {},
						isUserSelectable: true,
						modelPickerCategory: { label: 'Ollama (Local)', order: 1 },
						capabilities: {
							agentMode: true,
							toolCalling: true
						}
					}
				}));
			} catch (e) {
				this._logService.error('[Ollama] Error providing models', e);
				return [];
			}
		});
	}

	async sendChatRequest(modelId: string, messages: IChatMessage[], from: ExtensionIdentifier | undefined, options: ILanguageModelChatRequestOptions, token: CancellationToken): Promise<ILanguageModelChatResponse> {
		if (!isShadowAIProviderEnabled(this._configurationService, 'ollama')) {
			throw new Error('Shadow AI provider `ollama` is disabled by configuration.');
		}

		const endpoint = this._configurationService.getValue<string>(ShadowAIConfiguration.OllamaEndpoint);
		const model = modelId.replace('ollama:', '');

		const ollamaMessages = messages.map(m => ({
			role: this._mapRole(m.role),
			content: m.content.map(p => p.type === 'text' ? p.value : '').join('')
		}));

		const requestBody: IOllamaChatRequest = {
			model,
			messages: ollamaMessages,
			stream: true
		};

		const context = await this._requestService.request({
			url: `${endpoint}/api/chat`,
			type: 'POST',
			data: JSON.stringify(requestBody),
			headers: { 'Content-Type': 'application/json' },
			callSite: 'ollama'
		}, token);

		if (context.res.statusCode !== 200) {
			throw new Error(`Ollama request failed with status ${context.res.statusCode}`);
		}

		const source = new AsyncIterableSource<IChatResponsePart>();
		const result = new Promise<void>((resolve, reject) => {
			let buffer = '';
			listenStream(context.stream, {
				onData: chunk => {
					if (token.isCancellationRequested) {
						return;
					}
					buffer += chunk.toString();
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed) {
							continue;
						}
						try {
							const delta = JSON.parse(trimmed) as IOllamaChatResponseDelta;
							if (delta.message?.content) {
								source.emitOne({
									type: 'text',
									value: delta.message.content
								});
							}
							if (delta.done) {
								resolve();
								return;
							}
						} catch (e) {
							this._logService.error('[Ollama] Error parsing stream line', e, line);
						}
					}
				},
				onError: err => {
					source.reject(err);
					reject(err);
				},
				onEnd: () => {
					source.resolve();
					resolve();
				}
			});
		});

		return {
			stream: source.asyncIterable,
			result
		};
	}

	private _mapRole(role: ChatMessageRole): 'system' | 'user' | 'assistant' {
		switch (role) {
			case ChatMessageRole.System: return 'system';
			case ChatMessageRole.User: return 'user';
			case ChatMessageRole.Assistant: return 'assistant';
		}
	}

	async provideTokenCount(modelId: string, message: string | IChatMessage, token: CancellationToken): Promise<number> {
		// Ollama doesn't provide a token count API for chat yet, naive estimate
		const text = typeof message === 'string' ? message : message.content.map(p => p.type === 'text' ? p.value : '').join('');
		return Math.ceil(text.length / 4);
	}
}
