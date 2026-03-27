/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ICodeIssue {
	id: string;
	type: 'error' | 'warning' | 'info' | 'suggestion';
	message: string;
	location: {
		file: string;
		line: number;
		column: number;
	};
	fix?: {
		title: string;
		description: string;
		replacement: string;
	};
	relatedCode?: string;
}

export interface IRefactoringSuggestion {
	id: string;
	title: string;
	description: string;
	category: 'naming' | 'complexity' | 'duplication' | 'performance' | 'best-practice';
	severity: 'minor' | 'medium' | 'major';
	location: {
		file: string;
		line: number;
		column: number;
	};
	suggestion: string;
	before: string;
	after: string;
}

export interface ICodeMetrics {
	cyclomatic: number;
	lines: number;
	functions: number;
	classes: number;
	maintainabilityIndex: number;
}

/**
 * Code analyzer for intelligent suggestions and analysis
 */
export class CodeAnalyzer {
	/**
	 * Analyze code quality
	 */
	analyzeQuality(code: string, language: string = 'typescript'): ICodeIssue[] {
		const issues: ICodeIssue[] = [];
		const lines = code.split('\n');

		// Check for common patterns
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNum = i + 1;

			// Check for TODO/FIXME comments
			if (line.includes('TODO')) {
				issues.push({
					id: `todo-${i}`,
					type: 'info',
					message: 'TODO comment found',
					location: { file: 'current', line: lineNum, column: 0 },
				});
			}

			// Check for console.log
			if (line.includes('console.log')) {
				issues.push({
					id: `console-${i}`,
					type: 'warning',
					message: 'console.log found in code',
					location: { file: 'current', line: lineNum, column: line.indexOf('console.log') },
					fix: {
						title: 'Remove console.log',
						description: 'Remove debug logging',
						replacement: '// ' + line.trim(),
					},
				});
			}

			// Check for any
			if (language === 'typescript' && line.includes(': any')) {
				issues.push({
					id: `any-${i}`,
					type: 'warning',
					message: 'Using "any" type detected',
					location: { file: 'current', line: lineNum, column: line.indexOf(': any') },
					fix: { title: 'Use specific type', description: 'Replace with proper type', replacement: 'unknown' },
				});
			}

			// Check for long lines
			if (line.length > 120) {
				issues.push({
					id: `long-line-${i}`,
					type: 'suggestion',
					message: `Line is ${line.length} characters (exceeds 120)`,
					location: { file: 'current', line: lineNum, column: 0 },
				});
			}
		}

		return issues;
	}

	/**
	 * Suggest refactorings
	 */
	suggestRefactorings(code: string, language: string = 'typescript'): IRefactoringSuggestion[] {
		const suggestions: IRefactoringSuggestion[] = [];
		const lines = code.split('\n');

		// Check for duplicate code patterns
		const patterns = new Map<string, number[]>();
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (line.length > 20) {
				const count = patterns.get(line) || [];
				count.push(i);
				patterns.set(line, count);
			}
		}

		for (const [pattern, lineNumbers] of patterns) {
			if (lineNumbers.length > 2) {
				suggestions.push({
					id: `dup-${pattern.substring(0, 10)}`,
					title: 'Extract Duplicated Code',
					description: 'This code pattern appears multiple times',
					category: 'duplication',
					severity: 'medium',
					location: { file: 'current', line: lineNumbers[0] + 1, column: 0 },
					suggestion: 'Extract into a separate function',
					before: pattern,
					after: `function extracted() {\n  ${pattern}\n}`,
				});
			}
		}

		// Check for long functions
		let functionStart = -1;
		let braceCount = 0;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line.includes('function') || line.includes('(') && line.includes(')')) {
				functionStart = i;
				braceCount = 0;
			}

			braceCount += (line.match(/\{/g) || []).length;
			braceCount -= (line.match(/\}/g) || []).length;

			if (braceCount === 0 && functionStart !== -1 && i - functionStart > 50) {
				suggestions.push({
					id: `long-func-${functionStart}`,
					title: 'Break Down Long Function',
					description: `Function is ${i - functionStart} lines (exceeds 50)`,
					category: 'complexity',
					severity: 'major',
					location: { file: 'current', line: functionStart + 1, column: 0 },
					suggestion: 'Consider breaking this function into smaller, focused functions',
					before: `function long() {\n  // many lines\n}`,
					after: `function extracted1() { /* ... */ }\nfunction extracted2() { /* ... */ }`,
				});
				functionStart = -1;
			}
		}

		// Check for magic numbers
		const numberPattern = /\b\d{2,}\b/g;
		for (let i = 0; i < lines.length; i++) {
			const matches = lines[i].match(numberPattern) || [];
			for (const match of matches) {
				if (!lines[i].includes('const') && !lines[i].includes('=')) {
					suggestions.push({
						id: `magic-${i}-${match}`,
						title: 'Replace Magic Number',
						description: `Magic number "${match}" found`,
						category: 'best-practice',
						severity: 'minor',
						location: { file: 'current', line: i + 1, column: lines[i].indexOf(match) },
						suggestion: `Consider extracting to a named constant`,
						before: match,
						after: `const SOME_CONSTANT = ${match};`,
					});
				}
			}
		}

		return suggestions;
	}

	/**
	 * Calculate code metrics
	 */
	calculateMetrics(code: string): ICodeMetrics {
		const lines = code.split('\n');
		const nonEmptyLines = lines.filter(l => l.trim().length > 0);

		// Count functions
		const functionPattern = /function\s+\w+|=>\s*{|\(\s*[^)]*\s*\)\s*{/g;
		const functions = (code.match(functionPattern) || []).length;

		// Count classes
		const classPattern = /class\s+\w+/g;
		const classes = (code.match(classPattern) || []).length;

		// Cyclomatic complexity (simplified)
		const conditionPattern = /if|else|for|while|case|catch|\?/g;
		const cyclomatic = Math.max(1, (code.match(conditionPattern) || []).length / Math.max(1, functions));

		// Maintainability Index (simplified formula)
		const mi = Math.max(0, Math.min(100,
			171 - 5.2 * Math.log(Math.max(1, nonEmptyLines.length)) -
			0.23 * cyclomatic - 16.2 * Math.log(Math.max(1, functions))
		));

		return {
			cyclomatic: Math.round(cyclomatic * 10) / 10,
			lines: nonEmptyLines.length,
			functions,
			classes,
			maintainabilityIndex: Math.round(mi),
		};
	}

	/**
	 * Detect code patterns
	 */
	detectPatterns(code: string): string[] {
		const patterns: string[] = [];

		// Callback pattern
		if (code.includes('.then(') || code.includes('.catch(')) {
			patterns.push('promise-based-callbacks');
		}

		// Async/await pattern
		if (code.includes('async') && code.includes('await')) {
			patterns.push('async-await');
		}

		// Try-catch pattern
		if (code.includes('try') && code.includes('catch')) {
			patterns.push('error-handling');
		}

		// Decorator pattern
		if (code.includes('@')) {
			patterns.push('decorators');
		}

		// Singleton pattern
		if (code.includes('private constructor') || code.includes('static instance')) {
			patterns.push('singleton');
		}

		// Factory pattern
		if (code.includes('create') && code.includes('Factory')) {
			patterns.push('factory');
		}

		// Observer pattern
		if (code.includes('subscribe') || code.includes('addEventListener')) {
			patterns.push('observer');
		}

		// Middleware pattern
		if (code.includes('next()') || code.includes('middleware')) {
			patterns.push('middleware');
		}

		return patterns;
	}

	/**
	 * Suggest improvements
	 */
	suggestImprovements(code: string, language: string = 'typescript'): string[] {
		const improvements: string[] = [];
		const metrics = this.calculateMetrics(code);
		const patterns = this.detectPatterns(code);

		// Suggest based on metrics
		if (metrics.cyclomatic > 10) {
			improvements.push('Consider reducing cyclomatic complexity by breaking down complex logic');
		}

		if (metrics.maintainabilityIndex < 50) {
			improvements.push('Code maintainability is low. Consider refactoring for clarity');
		}

		if (metrics.lines > 500) {
			improvements.push('File is very large. Consider splitting into multiple modules');
		}

		// Suggest based on patterns
		if (patterns.includes('promise-based-callbacks')) {
			improvements.push('Consider using async/await instead of promise chains');
		}

		if (patterns.includes('error-handling')) {
			improvements.push('Good error handling pattern detected');
		}

		// Language-specific
		if (language === 'typescript') {
			if (!code.includes('interface') && !code.includes('type')) {
				improvements.push('Consider using TypeScript interfaces or types for better type safety');
			}
		}

		return improvements;
	}
}
