/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const REDACTED = '[REDACTED]';

export function sanitizeShadowAIErrorMessage(value: string): string {
	let result = value;
	result = result.replace(/(Bearer\s+)[A-Za-z0-9._~+\-/=]+/gi, `$1${REDACTED}`);
	result = result.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, REDACTED);
	result = result.replace(/\bhf_[A-Za-z0-9]{8,}\b/g, REDACTED);
	result = result.replace(/([?&](?:api[_-]?key|token|access_token)=)[^&\s]+/gi, `$1${REDACTED}`);
	result = result.replace(/((?:api[_-]?key|token|access_token)\s*[:=]\s*)[^,\s&}\]]+/gi, `$1${REDACTED}`);
	result = result.replace(/((?:"(?:api[_-]?key|token|access_token)"\s*:\s*))([^,}\]]+)/gi, `$1${REDACTED}`);
	result = result.replace(/((?:api[_-]?key|token|access_token)\"\s*:\s*\")[^\"]+(\")/gi, `$1${REDACTED}$2`);
	return result;
}
