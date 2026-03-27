/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRange, Range } from '../../../../../../editor/common/core/range.js';
import { IPosition } from '../../../../../../editor/common/core/position.js';
import { ITextModel } from '../../../../../../editor/common/model.js';

/**
 * Calculate the height needed for editor content
 */
export function calculateEditorHeight(lineCount: number, lineHeight: number, padding: { top: number; bottom: number }, maxHeight: number): number {
	const contentHeight = lineCount * lineHeight + padding.top + padding.bottom;
	return Math.min(contentHeight, maxHeight);
}

/**
 * Get the current language of the editor model
 */
export function getEditorLanguage(model: ITextModel | null): string {
	return model?.getLanguageId() ?? 'text';
}

/**
 * Check if position is at the end of the text
 */
export function isPositionAtEnd(position: IPosition, model: ITextModel): boolean {
	const lineCount = model.getLineCount();
	const lineLength = model.getLineLength(lineCount);
	return position.lineNumber === lineCount && position.column === lineLength + 1;
}

/**
 * Get the text from a range
 */
export function getRangeText(model: ITextModel, range: IRange): string {
	return model.getValueInRange(range);
}

/**
 * Get the word at position
 */
export function getWordAtPosition(model: ITextModel, position: IPosition): string {
	const wordRange = model.getWordUntilPosition(position);
	return getRangeText(model, new Range(position.lineNumber, wordRange.startColumn, position.lineNumber, wordRange.endColumn));
}

/**
 * Check if text is empty or whitespace only
 */
export function isEmptyOrWhitespace(text: string): boolean {
	return text.trim().length === 0;
}

/**
 * Sanitize text for display
 */
export function sanitizeForDisplay(text: string, maxLength: number = 1000): string {
	let sanitized = text.replace(/\r\n/g, '\n');
	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength) + '...';
	}
	return sanitized;
}

/**
 * Parse suggestions or slash commands from text
 */
export function parseSlashCommand(text: string): { command: string; args: string[] } | null {
	const trimmed = text.trim();
	if (!trimmed.startsWith('/')) {
		return null;
	}

	const parts = trimmed.substring(1).split(/\s+/);
	const command = parts[0];
	const args = parts.slice(1);

	return { command, args };
}

/**
 * Format model name for display
 */
export function formatModelName(fullId: string): string {
	const parts = fullId.split('/');
	return parts[parts.length - 1];
}

/**
 * Debounce a value update
 */
export class DebouncedValue<T> {
	private timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
	private currentValue: T | undefined;

	constructor(
		private readonly callback: (value: T) => void,
		private readonly delayMs: number = 300
	) {
	}

	setValue(value: T): void {
		this.currentValue = value;
		if (this.timeoutId !== undefined) {
			clearTimeout(this.timeoutId);
		}
		this.timeoutId = setTimeout(() => {
			if (this.currentValue !== undefined) {
				this.callback(this.currentValue);
			}
			this.timeoutId = undefined;
		}, this.delayMs);
	}

	dispose(): void {
		if (this.timeoutId !== undefined) {
			clearTimeout(this.timeoutId);
		}
	}
}

/**
 * Check if a string contains any HTML tags
 */
export function containsHtml(text: string): boolean {
	return /<[^>]*>/.test(text);
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		'\'': "&#039;",
	};
	return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Split text by newlines and filter empty lines
 */
export function splitLines(text: string): string[] {
	return text.split(/\r?\n/).filter(line => line.length > 0);
}
