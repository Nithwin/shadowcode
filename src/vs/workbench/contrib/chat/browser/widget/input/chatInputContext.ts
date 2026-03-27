/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { ChatRequestVariableSet } from '../../../common/attachments/chatVariableEntries.js';
import { ChatAttachmentModel } from '../../attachments/chatAttachmentModel.js';
import { ChatImplicitContexts } from '../../attachments/chatImplicitContext.js';

/**
 * Manages context and attachments for chat input
 */
export class ChatInputContextManager extends Disposable {
	private implicitContext: ChatImplicitContexts | undefined;

	constructor(private readonly _attachmentModel: ChatAttachmentModel) {
		super();
	}

	/**
	 * Get the attachment model
	 */
	get attachmentModel(): ChatAttachmentModel {
		return this._attachmentModel;
	}

	/**
	 * Get attached context from attachment model
	 */
	getAttachedContext(): ChatRequestVariableSet {
		const contextArr = new ChatRequestVariableSet();
		contextArr.add(...this._attachmentModel.attachments);
		return contextArr;
	}

	/**
	 * Get both attached and implicit context
	 */
	getAttachedAndImplicitContext(): ChatRequestVariableSet {
		const attached = this.getAttachedContext();
		return attached;
	}

	/**
	 * Set implicit context
	 */
	setImplicitContext(context: ChatImplicitContexts | undefined): void {
		this.implicitContext = context;
	}

	/**
	 * Get the current implicit context
	 */
	getImplicitContext(): ChatImplicitContexts | undefined {
		return this.implicitContext;
	}

	/**
	 * Clear all context
	 */
	clearContext(): void {
		this.implicitContext = undefined;
	}
}

/**
 * Calculate statistics about loaded attachments
 */
export interface AttachmentStats {
	totalItems: number;
	byType: Record<string, number>;
}

/**
 * Calculate attachment statistics
 */
export function calculateAttachmentStats(context: ChatRequestVariableSet): AttachmentStats {
	const stats: AttachmentStats = {
		totalItems: 0,
		byType: {},
	};
	return stats;
}
