/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IPromptTemplate {
	id: string;
	name: string;
	description: string;
	systemPrompt: string;
	userPromptTemplate: string;
	contextRequired: boolean;
	tags: string[];
}

export interface IRenderedPrompt {
	system: string;
	user: string;
}

/**
 * Prompt template manager for different tasks
 */
export class PromptTemplateManager {
	private _templates: Map<string, IPromptTemplate> = new Map();

	constructor() {
		this._registerDefaultTemplates();
	}

	/**
	 * Register a template
	 */
	registerTemplate(template: IPromptTemplate): void {
		this._templates.set(template.id, template);
	}

	/**
	 * Get a template
	 */
	getTemplate(id: string): IPromptTemplate | undefined {
		return this._templates.get(id);
	}

	/**
	 * Get all templates
	 */
	getAllTemplates(): IPromptTemplate[] {
		return Array.from(this._templates.values());
	}

	/**
	 * Get templates by tag
	 */
	getTemplatesByTag(tag: string): IPromptTemplate[] {
		return Array.from(this._templates.values()).filter(t => t.tags.includes(tag));
	}

	/**
	 * Render a template
	 */
	renderTemplate(id: string, context: Record<string, unknown>): IRenderedPrompt | undefined {
		const template = this._templates.get(id);
		if (!template) {
			return undefined;
		}

		return {
			system: this._substitute(template.systemPrompt, context),
			user: this._substitute(template.userPromptTemplate, context),
		};
	}

	private _substitute(template: string, context: Record<string, unknown>): string {
		return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
			const value = context[key];
			return value !== undefined ? String(value) : match;
		});
	}

	private _registerDefaultTemplates(): void {
		// Code generation template
		this._templates.set('code-generation', {
			id: 'code-generation',
			name: 'Code Generation',
			description: 'Generate code based on description',
			systemPrompt: `You are an expert code generation assistant.
Help the user generate clean, efficient, well-documented code.
Follow best practices and coding standards for the target language.
Provide explanations for complex logic.`,
			userPromptTemplate: `Generate {{language}} code for:

{{description}}

{{context}}

Requirements:
- Include proper error handling
- Add meaningful comments
- Follow {{language}} best practices`,
			contextRequired: false,
			tags: ['generation', 'code'],
		});

		// Code review template
		this._templates.set('code-review', {
			id: 'code-review',
			name: 'Code Review',
			description: 'Review and analyze code',
			systemPrompt: `You are an expert code reviewer.
Analyze code for:
- Correctness
- Performance
- Security
- Maintainability
- Best practices
Provide constructive feedback and suggestions.`,
			userPromptTemplate: `Please review the following {{language}} code:

{{code}}

Focus on:
{{focusAreas}}

Provide:
1. Overall assessment
2. Issues found
3. Suggestions for improvement`,
			contextRequired: true,
			tags: ['review', 'analysis'],
		});

		// Refactoring template
		this._templates.set('refactoring', {
			id: 'refactoring',
			name: 'Code Refactoring',
			description: 'Suggest refactorings and improvements',
			systemPrompt: `You are an expert code refactoring assistant.
Help improve code quality through:
- Better naming
- Simplification
- Optimization
- Design patterns
- Readability improvements`,
			userPromptTemplate: `Suggest refactorings for this {{language}} code:

{{code}}

Focus on:
- {{improvement1}}
- {{improvement2}}

Provide:
1. Current issues
2. Refactoring suggestions
3. Refactored code examples`,
			contextRequired: true,
			tags: ['refactoring', 'improvement'],
		});

		// Bug fixing template
		this._templates.set('bug-fixing', {
			id: 'bug-fixing',
			name: 'Bug Fixing',
			description: 'Help diagnose and fix bugs',
			systemPrompt: `You are an expert debugging assistant.
Help diagnose and fix bugs by:
- Understanding the problem
- Analyzing error messages
- Identifying root causes
- Suggesting fixes
- Providing test cases`,
			userPromptTemplate: `Help fix this bug:

Error/Issue: {{error}}
Code:
{{code}}

Context:
{{context}}

Provide:
1. Root cause analysis
2. Proposed fix
3. Test cases to verify`,
			contextRequired: true,
			tags: ['debugging', 'fixing'],
		});

		// Documentation template
		this._templates.set('documentation', {
			id: 'documentation',
			name: 'Documentation',
			description: 'Generate documentation',
			systemPrompt: `You are an expert technical writer.
Generate clear, comprehensive documentation that:
- Explains functionality
- Provides examples
- Documents parameters
- Includes use cases`,
			userPromptTemplate: `Generate documentation for:

{{code}}

Format: {{format}}
Target audience: {{audience}}

Include:
- Overview
- Parameters/Arguments
- Return values
- Examples
- Common use cases`,
			contextRequired: true,
			tags: ['documentation', 'writing'],
		});

		// Testing template
		this._templates.set('testing', {
			id: 'testing',
			name: 'Test Generation',
			description: 'Generate unit tests',
			systemPrompt: `You are an expert test writer.
Generate comprehensive test cases that:
- Cover normal cases
- Handle edge cases
- Test error conditions
- Follow testing best practices`,
			userPromptTemplate: `Generate {{framework}} tests for:

{{code}}

Coverage targets:
{{coverageTargets}}

Include:
- Happy path tests
- Edge case tests
- Error handling tests
- Mocking where appropriate`,
			contextRequired: true,
			tags: ['testing', 'generation'],
		});

		// Performance optimization template
		this._templates.set('performance', {
			id: 'performance',
			name: 'Performance Optimization',
			description: 'Optimize code for performance',
			systemPrompt: `You are an expert performance optimization specialist.
Identify performance bottlenecks and suggest optimizations:
- Algorithmic improvements
- Caching strategies
- Resource utilization
- Profiling recommendations`,
			userPromptTemplate: `Optimize this {{language}} code for performance:

{{code}}

Current performance characteristics:
{{performanceInfo}}

Provide:
1. Performance bottleneck analysis
2. Optimization suggestions
3. Optimized implementation
4. Expected improvements`,
			contextRequired: true,
			tags: ['performance', 'optimization'],
		});

		// Explanation template
		this._templates.set('explanation', {
			id: 'explanation',
			name: 'Code Explanation',
			description: 'Explain how code works',
			systemPrompt: `You are an expert code explainer.
Explain code clearly by:
- Breaking down logic
- Explaining each component
- Using analogies where helpful
- Providing context`,
			userPromptTemplate: `Explain this {{language}} code:

{{code}}

Level: {{level}}

Provide:
1. High-level overview
2. Step-by-step breakdown
3. Key concepts
4. Common pitfalls`,
			contextRequired: true,
			tags: ['explanation', 'learning'],
		});

		// Architecture template
		this._templates.set('architecture', {
			id: 'architecture',
			name: 'Architecture Design',
			description: 'Design software architecture',
			systemPrompt: `You are an expert software architect.
Design scalable, maintainable architectures by:
- Applying design patterns
- Considering scalability
- Ensuring maintainability
- Planning for extensibility`,
			userPromptTemplate: `Design architecture for:

{{requirements}}

Constraints:
{{constraints}}

Provide:
1. Architecture diagram description
2. Component breakdown
3. Design patterns used
4. Scalability considerations
5. Implementation roadmap`,
			contextRequired: false,
			tags: ['architecture', 'design'],
		});
	}
}
