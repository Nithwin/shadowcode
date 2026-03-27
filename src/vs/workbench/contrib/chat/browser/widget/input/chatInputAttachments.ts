/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore, DisposableMap } from '../../../../../../base/common/lifecycle.js';
import { ChatRequestVariableSet } from '../../../common/attachments/chatVariableEntries.js';

/**
 * Manages attachment widgets and their lifecycle
 */
export class ChatInputAttachmentManager extends Disposable {
	private readonly _renderingDisposables: DisposableStore = this._register(new DisposableStore());
	private readonly _attachmentWidgets = this._register(new DisposableMap<string, Disposable>());

	constructor() {
		super();
	}

	/**
	 * Clear all rendered attachments
	 */
	clearAttachments(): void {
		this._renderingDisposables.clear();
	}

	/**
	 * Get the number of attachment widgets
	 */
	getAttachmentCount(): number {
		return this._attachmentWidgets.size;
	}

	override dispose(): void {
		this._renderingDisposables.dispose();
		this._attachmentWidgets.dispose();
		super.dispose();
	}
}

/**
 * Attachment rendering options
 */
export interface AttachmentRenderOptions {
	container: HTMLElement;
	maxHeight?: number;
	compactMode?: boolean;
	theme?: string;
}

/**
 * Attachment widget metadata
 */
export interface AttachmentWidgetMetadata {
	id: string;
	label: string;
	canHandle: (variable: unknown) => boolean;
	priority: number; // Higher priority wins
}
