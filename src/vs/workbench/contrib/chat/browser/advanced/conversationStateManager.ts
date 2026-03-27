/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';

export interface IChatMessage {
	id: string;
	type: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: number;
	metadata?: Record<string, unknown>;
}

export interface IConversationState {
	id: string;
	title: string;
	messages: IChatMessage[];
	context: Record<string, unknown>;
	createdAt: number;
	updatedAt: number;
	isArchived: boolean;
}

export interface IConversationSnapshot {
	messages: IChatMessage[];
	context: Record<string, unknown>;
}

/**
 * Manages conversation state and history
 */
export class ConversationStateManager extends Disposable {
	private _conversations: Map<string, IConversationState> = new Map();
	private _currentConversationId: string | undefined;
	private _maxHistorySize: number = 100;

	private _onConversationCreated = this._register(new Emitter<IConversationState>());
	private _onMessageAdded = this._register(new Emitter<{ conversationId: string; message: IChatMessage }>());
	private _onConversationUpdated = this._register(new Emitter<IConversationState>());

	readonly onConversationCreated: Event<IConversationState> = this._onConversationCreated.event;
	readonly onMessageAdded: Event<{ conversationId: string; message: IChatMessage }> = this._onMessageAdded.event;
	readonly onConversationUpdated: Event<IConversationState> = this._onConversationUpdated.event;

	constructor() {
		super();
	}

	/**
	 * Create a new conversation
	 */
	createConversation(title: string = 'New Conversation'): IConversationState {
		const id = this._generateId();
		const conversation: IConversationState = {
			id,
			title,
			messages: [],
			context: {},
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isArchived: false,
		};
		this._conversations.set(id, conversation);
		this._currentConversationId = id;
		this._onConversationCreated.fire(conversation);
		return conversation;
	}

	/**
	 * Add a message to the current conversation
	 */
	addMessage(content: string, type: 'user' | 'assistant' | 'system' = 'user', metadata?: Record<string, unknown>): IChatMessage {
		const conversationId = this._currentConversationId;
		if (!conversationId) {
			throw new Error('No active conversation');
		}

		const conversation = this._conversations.get(conversationId);
		if (!conversation) {
			throw new Error(`Conversation ${conversationId} not found`);
		}

		const message: IChatMessage = {
			id: this._generateId(),
			type,
			content,
			timestamp: Date.now(),
			metadata,
		};

		// Keep history size limited
		if (conversation.messages.length >= this._maxHistorySize) {
			conversation.messages.shift();
		}

		conversation.messages.push(message);
		conversation.updatedAt = Date.now();

		this._onMessageAdded.fire({ conversationId, message });
		this._onConversationUpdated.fire(conversation);

		return message;
	}

	/**
	 * Get the current conversation
	 */
	getCurrentConversation(): IConversationState | undefined {
		if (!this._currentConversationId) {
			return undefined;
		}
		return this._conversations.get(this._currentConversationId);
	}

	/**
	 * Get a conversation by ID
	 */
	getConversation(id: string): IConversationState | undefined {
		return this._conversations.get(id);
	}

	/**
	 * Get all conversations
	 */
	getAllConversations(): IConversationState[] {
		return Array.from(this._conversations.values());
	}

	/**
	 * Set the current conversation
	 */
	setCurrentConversation(id: string): boolean {
		if (!this._conversations.has(id)) {
			return false;
		}
		this._currentConversationId = id;
		return true;
	}

	/**
	 * Get conversation snapshot for model
	 */
	getConversationSnapshot(): IConversationSnapshot | undefined {
		const conversation = this.getCurrentConversation();
		if (!conversation) {
			return undefined;
		}

		return {
			messages: conversation.messages,
			context: conversation.context,
		};
	}

	/**
	 * Update context for current conversation
	 */
	updateContext(context: Record<string, unknown>): void {
		const conversation = this.getCurrentConversation();
		if (!conversation) {
			throw new Error('No active conversation');
		}

		conversation.context = { ...conversation.context, ...context };
		conversation.updatedAt = Date.now();
		this._onConversationUpdated.fire(conversation);
	}

	/**
	 * Clear conversation history
	 */
	clearHistory(conversationId?: string): void {
		const id = conversationId || this._currentConversationId;
		if (!id) {
			return;
		}

		const conversation = this._conversations.get(id);
		if (conversation) {
			conversation.messages = [];
			conversation.updatedAt = Date.now();
			this._onConversationUpdated.fire(conversation);
		}
	}

	/**
	 * Archive a conversation
	 */
	archiveConversation(id: string): void {
		const conversation = this._conversations.get(id);
		if (conversation) {
			conversation.isArchived = true;
			this._onConversationUpdated.fire(conversation);
		}
	}

	/**
	 * Delete a conversation
	 */
	deleteConversation(id: string): void {
		this._conversations.delete(id);
		if (this._currentConversationId === id) {
			this._currentConversationId = undefined;
		}
	}

	/**
	 * Export conversation
	 */
	exportConversation(id: string): string {
		const conversation = this._conversations.get(id);
		if (!conversation) {
			return '';
		}
		return JSON.stringify(conversation, null, 2);
	}

	/**
	 * Import conversation
	 */
	importConversation(json: string): IConversationState | null {
		try {
			const conversation = JSON.parse(json) as IConversationState;
			this._conversations.set(conversation.id, conversation);
			return conversation;
		} catch (error) {
			return null;
		}
	}

	private _generateId(): string {
		return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
	}
}
