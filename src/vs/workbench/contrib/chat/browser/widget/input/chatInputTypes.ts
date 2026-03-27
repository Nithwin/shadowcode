/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../base/common/uri.js';
import { ILanguageModelChatMetadata } from '../../../common/languageModels.js';
import { IChatMode } from '../../../common/chatModes.js';
import { MenuId } from '../../../../../../platform/actions/common/actions.js';
import { observableMemento } from '../../../../../../platform/observable/common/observableMemento.js';
import { mixin } from '../../../../../../base/common/objects.js';
import { IChatModelInputState } from '../../../common/model/chatModel.js';
import { ChatAgentLocation } from '../../../common/constants.js';
import { ISessionTypePickerDelegate, IWorkspacePickerDelegate } from '../../chat.js';

export interface IChatInputStyles {
	overlayBackground: string;
	listForeground: string;
	listBackground: string;
}

export interface IChatInputPartOptions {
	defaultMode?: IChatMode;
	renderFollowups: boolean;
	renderStyle?: 'compact';
	renderInputToolbarBelowInput: boolean;
	menus: {
		executeToolbar: MenuId;
		telemetrySource: string;
		inputSideToolbar?: MenuId;
	};
	editorOverflowWidgetsDomNode?: HTMLElement;
	renderWorkingSet: boolean;
	enableImplicitContext?: boolean;
	supportsChangingModes?: boolean;
	dndContainer?: HTMLElement;
	inputEditorMinLines?: number;
	widgetViewKindTag: string;
	/**
	 * Optional delegate for the session target picker.
	 * When provided, allows the input part to maintain independent state for the selected session type.
	 */
	sessionTypePickerDelegate?: ISessionTypePickerDelegate;
	/**
	 * Optional delegate for the workspace picker.
	 * When provided, shows a workspace picker allowing users to select a target workspace
	 * for their chat request. This is useful for empty window contexts.
	 */
	workspacePickerDelegate?: IWorkspacePickerDelegate;
	/**
	 * Whether we are running in the sessions window.
	 * When true, the secondary toolbar (permissions picker) is hidden.
	 */
	isSessionsWindow?: boolean;
}

export interface IWorkingSetEntry {
	uri: URI;
}

export const enum ChatWidgetLocation {
	SidebarLeft = 'sidebarLeft',
	SidebarRight = 'sidebarRight',
	Panel = 'panel',
	Editor = 'editor',
}

export interface IChatWidgetLocationInfo {
	readonly location: ChatWidgetLocation;
	readonly isMaximized: boolean;
}

/**
 * Create observable memento for chat input state persistence
 */
export const createInputStateMemento = observableMemento<IChatModelInputState | undefined>({
	defaultValue: undefined,
	key: 'chat.untitledInputState',
	toStorage: JSON.stringify,
	fromStorage(value) {
		const obj = JSON.parse(value) as IChatModelInputState;
		if (obj.selectedModel && !obj.selectedModel.metadata.isDefaultForLocation) {
			// Migrate old `isDefault` to `isDefaultForLocation`
			type OldILanguageModelChatMetadata = ILanguageModelChatMetadata & { isDefault?: boolean };
			const oldIsDefault = (obj.selectedModel.metadata as OldILanguageModelChatMetadata).isDefault;
			const isDefaultForLocation = { [ChatAgentLocation.Chat]: Boolean(oldIsDefault) };
			mixin(obj.selectedModel.metadata, { isDefaultForLocation: isDefaultForLocation } satisfies Partial<ILanguageModelChatMetadata>);
			delete (obj.selectedModel.metadata as OldILanguageModelChatMetadata).isDefault;
		}
		return obj;
	},
});

export const INPUT_EDITOR_MAX_HEIGHT = 250;
export const INPUT_EDITOR_LINE_HEIGHT = 20;
export const INPUT_EDITOR_PADDING = { compact: { top: 2, bottom: 2 }, default: { top: 12, bottom: 12 } };
export const CachedLanguageModelsKey = 'chat.cachedLanguageModels.v2';
export const CHAT_INPUT_PICKER_COLLAPSE_WIDTH = 320;
export const INPUT_EDITOR_DEFAULTS = {
	maxHeight: INPUT_EDITOR_MAX_HEIGHT,
	lineHeight: INPUT_EDITOR_LINE_HEIGHT,
	padding: INPUT_EDITOR_PADDING,
};
