/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';

export interface IStreamingResponse {
	id: string;
	status: 'streaming' | 'completed' | 'error' | 'cancelled';
	content: string;
	error?: Error;
	metadata?: Record<string, unknown>;
}

/**
 * Handles streaming responses from language models
 */
export class StreamingResponseHandler extends Disposable {
	private _responses: Map<string, IStreamingResponse> = new Map();
	private _onStreamUpdate = this._register(new Emitter<{ id: string; chunk: string }>());
	private _onStreamComplete = this._register(new Emitter<{ id: string; response: IStreamingResponse }>());
	private _onStreamError = this._register(new Emitter<{ id: string; error: Error }>());

	readonly onStreamUpdate: Event<{ id: string; chunk: string }> = this._onStreamUpdate.event;
	readonly onStreamComplete: Event<{ id: string; response: IStreamingResponse }> = this._onStreamComplete.event;
	readonly onStreamError: Event<{ id: string; error: Error }> = this._onStreamError.event;

	constructor() {
		super();
	}

	/**
	 * Start streaming a response
	 */
	startStream(id: string): IStreamingResponse {
		const response: IStreamingResponse = {
			id,
			status: 'streaming',
			content: '',
		};
		this._responses.set(id, response);
		return response;
	}

	/**
	 * Add a chunk to the stream
	 */
	appendChunk(id: string, chunk: string): void {
		const response = this._responses.get(id);
		if (!response) {
			return;
		}

		response.content += chunk;
		this._onStreamUpdate.fire({ id, chunk });
	}

	/**
	 * Complete the stream
	 */
	completeStream(id: string, metadata?: Record<string, unknown>): IStreamingResponse {
		const response = this._responses.get(id);
		if (!response) {
			return {
				id,
				status: 'completed',
				content: '',
			};
		}

		response.status = 'completed';
		response.metadata = metadata;
		this._onStreamComplete.fire({ id, response });
		return response;
	}

	/**
	 * Error the stream
	 */
	errorStream(id: string, error: Error): void {
		const response = this._responses.get(id);
		if (!response) {
			return;
		}

		response.status = 'error';
		response.error = error;
		this._onStreamError.fire({ id, error });
	}

	/**
	 * Cancel the stream
	 */
	cancelStream(id: string): void {
		const response = this._responses.get(id);
		if (!response) {
			return;
		}

		response.status = 'cancelled';
	}

	/**
	 * Get the current response
	 */
	getResponse(id: string): IStreamingResponse | undefined {
		return this._responses.get(id);
	}

	/**
	 * Stream from an async iterator
	 */
	async streamFromIterator<T>(
		id: string,
		iterator: AsyncIterableIterator<T>,
		stringify: (item: T) => string,
		token: CancellationToken
	): Promise<IStreamingResponse> {
		this.startStream(id);

		try {
			for await (const item of iterator) {
				if (token.isCancellationRequested) {
					this.cancelStream(id);
					break;
				}

				const chunk = stringify(item);
				this.appendChunk(id, chunk);
			}

			return this.completeStream(id);
		} catch (error) {
			this.errorStream(id, error instanceof Error ? error : new Error(String(error)));
			throw error;
		}
	}

	/**
	 * Clear a response
	 */
	clearResponse(id: string): void {
		this._responses.delete(id);
	}

	/**
	 * Clear all responses
	 */
	clearAll(): void {
		this._responses.clear();
	}
}

/**
 * Accumulates streaming responses into a complete message
 */
export class StreamAccumulator extends Disposable {
	private _content: string = '';
	private _chunks: string[] = [];
	private _metadata: Record<string, unknown> = {};

	constructor(
		private _streamingHandler: StreamingResponseHandler,
		private _streamId: string,
	) {
		super();

		this._register(
			this._streamingHandler.onStreamUpdate(({ id, chunk }) => {
				if (id === this._streamId) {
					this._chunks.push(chunk);
					this._content += chunk;
				}
			})
		);
	}

	/**
	 * Get accumulated content
	 */
	getContent(): string {
		return this._content;
	}

	/**
	 * Get chunks
	 */
	getChunks(): string[] {
		return this._chunks;
	}

	/**
	 * Get metadata
	 */
	getMetadata(): Record<string, unknown> {
		return this._metadata;
	}

	/**
	 * Set metadata
	 */
	setMetadata(metadata: Record<string, unknown>): void {
		this._metadata = { ...this._metadata, ...metadata };
	}

	/**
	 * Wait for completion
	 */
	async waitForCompletion(): Promise<string> {
		return new Promise((resolve, reject) => {
			const disposable = this._streamingHandler.onStreamComplete(({ id, response }) => {
				if (id === this._streamId) {
					disposable.dispose();
					resolve(response.content);
				}
			});

			this._register(
				this._streamingHandler.onStreamError(({ id, error }) => {
					if (id === this._streamId) {
						disposable.dispose();
						reject(error);
					}
				})
			);
		});
	}
}
