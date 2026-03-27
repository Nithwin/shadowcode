/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { InlineCompletion, InlineCompletionTriggerKind, InlineCompletionsProvider, InlineCompletions } from '../../../../../../editor/common/languages.js';
import { ITextModel } from '../../../../../../editor/common/model.js';
import { ILanguageModelsService, IChatMessage, ChatMessageRole } from '../../../common/languageModels.js';

export class ChatInlineCompletionsProvider extends Disposable implements InlineCompletionsProvider<InlineCompletions<InlineCompletion>> {

	constructor(
		private readonly _languageModelsService: ILanguageModelsService,
		private readonly _getSelectedModelId: () => string | undefined,
	) {
		super();
	}

	async provideInlineCompletions(
		model: ITextModel,
		position: { lineNumber: number; column: number },
		context: { triggerKind: InlineCompletionTriggerKind; selectedSuggestionInfo: unknown | undefined },
		token: CancellationToken
	): Promise<InlineCompletions<InlineCompletion> | null> {
		const modelId = this._getSelectedModelId();
		if (!modelId) {
			return null;
		}

		const text = model.getValueInRange({
			startLineNumber: 1,
			startColumn: 1,
			endLineNumber: position.lineNumber,
			endColumn: position.column
		});

		const trimmed = text.trim();
		if (!trimmed || trimmed.length < 3) {
			return null;
		}

		try {
			const messages: IChatMessage[] = [
				{
					role: ChatMessageRole.User,
					content: [
						{
							type: 'text',
							value: trimmed
						}
					]
				}
			];

			// Request streaming response
			await this._languageModelsService.sendChatRequest(
				modelId,
				undefined,
				messages,
				{ maxTokens: 200 },
				token
			);

			// For now, return empty until we can properly handle streaming
			return { items: [] };
		} catch (error) {
			// Silently handle errors and return null
			return null;
		}
	}

	disposeInlineCompletions(completions: InlineCompletions<InlineCompletion>, reason: unknown): void {
	}
}
