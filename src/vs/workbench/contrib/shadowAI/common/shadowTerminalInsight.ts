/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ShadowCode Contributors. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

export interface IShadowTerminalInsight {
	readonly category: 'missingCommand' | 'dependency' | 'typescript' | 'python' | 'permission' | 'generic';
	readonly confidence: number;
	readonly summary: string;
	readonly suggestedNextCommand: string;
}

export function analyzeShadowTerminalOutput(output: string): IShadowTerminalInsight {
	const text = output.toLowerCase();

	if (/command not found|not recognized as an internal or external command/.test(text)) {
		const missing = extractMissingCommand(output);
		return {
			category: 'missingCommand',
			confidence: 0.92,
			summary: missing ? `Missing command detected: ${missing}.` : 'Missing command detected in terminal output.',
			suggestedNextCommand: missing ? `command -v ${missing} || echo \"Install ${missing} and retry\"` : 'command -v <tool> || echo "Install tool and retry"'
		};
	}

	if (/enoent|module not found|cannot find module|npm err/.test(text)) {
		return {
			category: 'dependency',
			confidence: 0.88,
			summary: 'Dependency or package resolution error detected.',
			suggestedNextCommand: 'npm install && npm run build'
		};
	}

	if (/typescript|ts\d{4}|type error|finished compilation with \d+ errors/.test(text)) {
		return {
			category: 'typescript',
			confidence: 0.9,
			summary: 'TypeScript compilation errors detected.',
			suggestedNextCommand: 'npm run watch-clientd'
		};
	}

	if (/traceback|modulenotfounderror|importerror|python/.test(text)) {
		return {
			category: 'python',
			confidence: 0.82,
			summary: 'Python runtime/import failure detected.',
			suggestedNextCommand: 'python -m pip install -r requirements.txt'
		};
	}

	if (/permission denied|eacces/.test(text)) {
		return {
			category: 'permission',
			confidence: 0.84,
			summary: 'Permission-related command failure detected.',
			suggestedNextCommand: 'ls -la && whoami'
		};
	}

	return {
		category: 'generic',
		confidence: 0.5,
		summary: 'No specialized error signature matched. Provide more output for deeper diagnosis.',
		suggestedNextCommand: 'echo "Capture full stdout/stderr and rerun analysis"'
	};
}

function extractMissingCommand(output: string): string | undefined {
	const commandNotFoundMatch = output.match(/([a-zA-Z0-9._-]+):\s*command not found/);
	if (commandNotFoundMatch?.[1]) {
		return commandNotFoundMatch[1];
	}

	const windowsMatch = output.match(/'([^']+)'\s+is not recognized as an internal or external command/);
	if (windowsMatch?.[1]) {
		return windowsMatch[1];
	}

	return undefined;
}
