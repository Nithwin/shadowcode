/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


export interface IOllamaModel {
	readonly name: string;
	readonly model: string;
	readonly modified_at: string;
	readonly size: number;
	readonly digest: string;
	readonly details: {
		readonly parent_model: string;
		readonly format: string;
		readonly family: string;
		readonly families: string[];
		readonly parameter_size: string;
		readonly quantization_level: string;
	};
}

export interface IOllamaTagsResponse {
	readonly models: IOllamaModel[];
}

export interface IOllamaChatMessage {
	readonly role: 'system' | 'user' | 'assistant';
	readonly content: string;
	readonly images?: string[]; // base64
}

export interface IOllamaChatRequest {
	readonly model: string;
	readonly messages: IOllamaChatMessage[];
	readonly stream?: boolean;
	readonly format?: 'json';
	readonly keep_alive?: string;
	readonly options?: Record<string, unknown>;
}

export interface IOllamaChatResponseDelta {
	readonly model: string;
	readonly created_at: string;
	readonly message: {
		readonly role: 'assistant';
		readonly content: string;
	};
	readonly done: boolean;
	readonly total_duration?: number;
	readonly load_duration?: number;
	readonly prompt_eval_count?: number;
	readonly prompt_eval_duration?: number;
	readonly eval_count?: number;
	readonly eval_duration?: number;
}
