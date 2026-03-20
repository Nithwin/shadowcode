/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { AsyncIterableSource } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IDisposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { listenStream } from '../../../../base/common/stream.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IRequestService } from '../../../../platform/request/common/request.js';
import { ILanguageModelChatInfoOptions, ILanguageModelChatMetadataAndIdentifier, ILanguageModelChatProvider, IChatMessage, ILanguageModelChatRequestOptions, ILanguageModelChatResponse, IChatResponsePart, ChatMessageRole } from '../../chat/common/languageModels.js';
import { ShadowAIConfiguration } from '../common/shadowAISettings.js';

interface IOpenRouterDelta {
	choices?: Array<{
		delta?: { content?: string };
		finish_reason?: string | null;
	}>;
}

export class OpenRouterLanguageModelProvider implements ILanguageModelChatProvider, IDisposable {

	private readonly _onDidChange = new Emitter<void>();
	readonly onDidChange: Event<void> = this._onDidChange.event;

	private readonly _store = new DisposableStore();

	constructor(
		@IRequestService private readonly requestService: IRequestService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILogService private readonly logService: ILogService,
	) { }

	dispose(): void {
		this._store.dispose();
		this._onDidChange.dispose();
	}

	async provideLanguageModelChatInfo(options: ILanguageModelChatInfoOptions, token: CancellationToken): Promise<ILanguageModelChatMetadataAndIdentifier[]> {
		const models = this.configurationService.getValue<string[]>(ShadowAIConfiguration.OpenRouterModels) || [];
		return models.map(model => ({
			identifier: `openrouter:${model}`,
			metadata: {
				extension: new ExtensionIdentifier('shadowcode.openrouter'),
				name: model,
				id: `openrouter:${model}`,
				vendor: 'openrouter',
				version: 'latest',
				family: 'openrouter',
				maxInputTokens: 8192,
				maxOutputTokens: 8192,
				isDefaultForLocation: {},
				isUserSelectable: true,
				modelPickerCategory: { label: 'OpenRouter', order: 3 },
				capabilities: {
					agentMode: true,
					toolCalling: true
				}
			}
		}));
	}

	async sendChatRequest(modelId: string, messages: IChatMessage[], from: ExtensionIdentifier | undefined, options: ILanguageModelChatRequestOptions, token: CancellationToken): Promise<ILanguageModelChatResponse> {
		const endpoint = this.configurationService.getValue<string>(ShadowAIConfiguration.OpenRouterEndpoint);
		const apiKey = this.configurationService.getValue<string>(ShadowAIConfiguration.OpenRouterApiKey);
		if (!apiKey) {
			throw new Error('OpenRouter API key is not configured. Set shadowAI.openRouterApiKey in settings.');
		}

		const model = modelId.replace('openrouter:', '');
		const requestMessages = messages.map(message => ({
			role: this.mapRole(message.role),
			content: message.content.map(part => part.type === 'text' ? part.value : '').join('')
		}));

		const requestBody = {
			model,
			messages: requestMessages,
			stream: true
		};

		const context = await this.requestService.request({
			url: `${endpoint}/chat/completions`,
			type: 'POST',
			data: JSON.stringify(requestBody),
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
				'HTTP-Referer': 'https://shadowcode.dev',
				'X-Title': 'ShadowCode'
			},
			callSite: 'openrouter'
		}, token);

		if (context.res.statusCode !== 200) {
			throw new Error(`OpenRouter request failed with status ${context.res.statusCode}`);
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
						if (!trimmed || !trimmed.startsWith('data:')) {
							continue;
						}

						const payload = trimmed.slice(5).trim();
						if (payload === '[DONE]') {
							resolve();
							return;
						}

						try {
							const delta = JSON.parse(payload) as IOpenRouterDelta;
							const text = delta.choices?.[0]?.delta?.content;
							if (text) {
								source.emitOne({ type: 'text', value: text });
							}
							if (delta.choices?.[0]?.finish_reason) {
								resolve();
								return;
							}
						} catch (error) {
							this.logService.error('[OpenRouter] Failed to parse stream payload', error, payload);
						}
					}
				},
				onError: error => {
					source.reject(error);
					reject(error);
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

	private mapRole(role: ChatMessageRole): 'system' | 'user' | 'assistant' {
		switch (role) {
			case ChatMessageRole.System: return 'system';
			case ChatMessageRole.User: return 'user';
			case ChatMessageRole.Assistant: return 'assistant';
		}
	}

	async provideTokenCount(modelId: string, message: string | IChatMessage, token: CancellationToken): Promise<number> {
		const text = typeof message === 'string' ? message : message.content.map(part => part.type === 'text' ? part.value : '').join('');
		return Math.ceil(text.length / 4);
	}
}
