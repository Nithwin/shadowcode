/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { IContextKeyService, IContextKey } from '../../../../../../platform/contextkey/common/contextkey.js';
import { ChatPermissionLevel } from '../../../common/constants.js';
import { IChatMode } from '../../../common/chatModes.js';
import { ILanguageModelChatMetadataAndIdentifier } from '../../../common/languageModels.js';

/**
 * Manages model, mode, and permission picker state
 */
export class ChatInputPickerManager extends Disposable {
	private readonly _modelChangeEmitter = this._register(new Emitter<ILanguageModelChatMetadataAndIdentifier | undefined>());
	private readonly _modeChangeEmitter = this._register(new Emitter<IChatMode>());
	private readonly _permissionChangeEmitter = this._register(new Emitter<ChatPermissionLevel>());

	private currentMode: IChatMode | undefined;
	private currentPermissionLevel: ChatPermissionLevel;
	private currentModel: ILanguageModelChatMetadataAndIdentifier | undefined;

	private readonly _optionContextKeys: Map<string, IContextKey<string>> = new Map();

	constructor(
		private readonly contextKeyService: IContextKeyService
	) {
		super();
		this.currentPermissionLevel = ChatPermissionLevel.Default;
	}

	/**
	 * Set the current mode
	 */
	setMode(mode: IChatMode): void {
		this.currentMode = mode;
		this._modeChangeEmitter.fire(mode);
	}

	/**
	 * Get current mode
	 */
	getMode(): IChatMode | undefined {
		return this.currentMode;
	}

	/**
	 * Event fired when mode changes
	 */
	get onModeChange(): Event<IChatMode> {
		return this._modeChangeEmitter.event;
	}

	/**
	 * Set the current permission level
	 */
	setPermissionLevel(level: ChatPermissionLevel): void {
		this.currentPermissionLevel = level;
		this._permissionChangeEmitter.fire(level);
	}

	/**
	 * Get current permission level
	 */
	getPermissionLevel(): ChatPermissionLevel {
		return this.currentPermissionLevel;
	}

	/**
	 * Event fired when permission level changes
	 */
	get onPermissionChange(): Event<ChatPermissionLevel> {
		return this._permissionChangeEmitter.event;
	}

	/**
	 * Set the current model
	 */
	setModel(model: ILanguageModelChatMetadataAndIdentifier | undefined): void {
		this.currentModel = model;
		this._modelChangeEmitter.fire(model);
	}

	/**
	 * Get current model
	 */
	getModel(): ILanguageModelChatMetadataAndIdentifier | undefined {
		return this.currentModel;
	}

	/**
	 * Event fired when model changes
	 */
	get onModelChange(): Event<ILanguageModelChatMetadataAndIdentifier | undefined> {
		return this._modelChangeEmitter.event;
	}

	/**
	 * Register or get a context key for an option
	 */
	getOrCreateOptionContextKey(id: string): IContextKey<string> {
		if (!this._optionContextKeys.has(id)) {
			const key = this.contextKeyService.createKey(`chat.option.${id}`, '');
			this._optionContextKeys.set(id, key);
		}
		return this._optionContextKeys.get(id)!;
	}

	/**
	 * Set context key value for an option
	 */
	setOptionContextKeyValue(id: string, value: string): void {
		const key = this.getOrCreateOptionContextKey(id);
		key.set(value);
	}
}

/**
 * State tracking for picker operations
 */
export interface PickerState {
	isModelPickerOpen: boolean;
	isModePickerOpen: boolean;
	isPermissionPickerOpen: boolean;
	isSessionTargetPickerOpen: boolean;
}

/**
 * Create initial picker state
 */
export function createInitialPickerState(): PickerState {
	return {
		isModelPickerOpen: false,
		isModePickerOpen: false,
		isPermissionPickerOpen: false,
		isSessionTargetPickerOpen: false,
	};
}
