/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, MutableDisposable } from '../../../../../../base/common/lifecycle.js';
import { RunOnceScheduler } from '../../../../../../base/common/async.js';
import { MenuWorkbenchToolBar } from '../../../../../../platform/actions/browser/toolbar.js';
import { MenuWorkbenchButtonBar } from '../../../../../../platform/actions/browser/buttonbar.js';
import { MenuId } from '../../../../../../platform/actions/common/actions.js';

/**
 * Manages the toolbar UI for chat input
 */
export class ChatInputToolbarManager extends Disposable {
	private _mainToolbar: MutableDisposable<MenuWorkbenchToolBar> = this._register(new MutableDisposable<MenuWorkbenchToolBar>());
	private _executeToolbar: MutableDisposable<MenuWorkbenchButtonBar> = this._register(new MutableDisposable<MenuWorkbenchButtonBar>());
	private _sideToolbar: MutableDisposable<MenuWorkbenchToolBar> = this._register(new MutableDisposable<MenuWorkbenchToolBar>());
	private readonly _relayoutScheduler: RunOnceScheduler;
	private cachedWidth: number | undefined;

	constructor() {
		super();
		this._relayoutScheduler = this._register(new RunOnceScheduler(() => {
			this.relayout();
		}, 300));
	}

	/**
	 * Schedule toolbar relayout
	 */
	scheduleRelayout(): void {
		this._relayoutScheduler.schedule();
	}

	/**
	 * Perform layout with width constraint
	 */
	private relayout(): void {
		if (typeof this.cachedWidth === 'number') {
			this.constrainWidth(this.cachedWidth);
		}
	}

	/**
	 * Set cached width for layout calculations
	 */
	setCachedWidth(width: number): void {
		this.cachedWidth = width;
	}

	/**
	 * Constrain toolbar width
	 */
	private constrainWidth(width: number): void {
		// Subclasses can override this for specific behavior
	}

	/**
	 * Get the main toolbar
	 */
	get mainToolbar(): MenuWorkbenchToolBar | undefined {
		return this._mainToolbar.value;
	}

	/**
	 * Get the execute toolbar
	 */
	get executeToolbar(): MenuWorkbenchButtonBar | undefined {
		return this._executeToolbar.value;
	}

	/**
	 * Get the side toolbar
	 */
	get sideToolbar(): MenuWorkbenchToolBar | undefined {
		return this._sideToolbar.value;
	}

	override dispose(): void {
		this._mainToolbar.dispose();
		this._executeToolbar.dispose();
		this._sideToolbar.dispose();
		this._relayoutScheduler.dispose();
		super.dispose();
	}
}

/**
 * Options for toolbar creation
 */
export interface ToolbarCreationOptions {
	renderInputToolbarBelowInput: boolean;
	menus: {
		executeToolbar: MenuId;
		telemetrySource: string;
		inputSideToolbar?: MenuId;
	};
	editorOverflowWidgetsDomNode?: HTMLElement;
}
