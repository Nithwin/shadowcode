/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Example: Using Advanced VS Copilot Features
 *
 * This example demonstrates how to use the advanced chat system with all features.
 */

import { AdvancedChatOrchestrator } from './advancedChatOrchestrator.js';
import { FileContextProvider, SymbolContextProvider } from './contextProviders.js';
import { FileTool, TerminalTool } from './toolRegistry.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';

export async function exampleAdvancedChat() {
	// Initialize the orchestrator
	const chat = new AdvancedChatOrchestrator();

	// Register context providers
	chat.registerContextProvider(
		new FileContextProvider(
			() => 'src/index.ts',
			(file) => ['src/types.ts', 'src/utils.ts']
		)
	);

	chat.registerContextProvider(
		new SymbolContextProvider(
			(query) => [
				{
					name: 'MyInterface',
					kind: 'interface',
					file: 'src/types.ts',
					range: { start: 0, end: 50 }
				}
			]
		)
	);

	// Register tools
	chat.registerTool(
		new FileTool(
			async (path) => `// Content of ${path}`,
			async (path, content) => { console.log(`Write to ${path}`); },
			async (path) => { console.log(`Delete ${path}`); }
		)
	);

	chat.registerTool(
		new TerminalTool(
			async (command) => ({
				stdout: `Output of: ${command}`,
				stderr: '',
				exitCode: 0
			})
		)
	);

	// Example 1: Code generation with streaming
	console.log('\n=== Example 1: Code Generation ===');
	try {
		const response1 = await chat.processRequest(
			{
				userMessage: 'Generate a TypeScript function to parse JSON with error handling',
				templateId: 'code-generation',
				context: { language: 'TypeScript', description: 'Parse JSON safely' },
				includeCodeAnalysis: true,
				streaming: true,
			},
			CancellationToken.None
		);

		console.log(`Response: ${response1.message}`);
		console.log(`Suggestions: ${response1.suggestions?.join(', ')}`);
	} catch (error) {
		console.error('Error in code generation:', error);
	}

	// Example 2: Code review with analysis
	console.log('\n=== Example 2: Code Review ===');
	try {
		const response2 = await chat.processRequest(
			{
				userMessage: 'Review this code for performance issues',
				templateId: 'code-review',
				context: { language: 'TypeScript', focusAreas: 'Performance' },
				includeCodeAnalysis: true,
			},
			CancellationToken.None
		);

		console.log(`Response: ${response2.message}`);
	} catch (error) {
		console.error('Error in code review:', error);
	}

	// Example 3: Refactoring suggestions
	console.log('\n=== Example 3: Refactoring ===');
	try {
		const response3 = await chat.processRequest(
			{
				userMessage: 'Suggest refactorings for this code',
				templateId: 'refactoring',
				context: { improvement1: 'Code clarity', improvement2: 'Performance' },
				includeCodeAnalysis: true,
			},
			CancellationToken.None
		);

		console.log(`Response: ${response3.message}`);
		console.log(`Analysis: ${JSON.stringify(response3.analysis, null, 2)}`);
	} catch (error) {
		console.error('Error in refactoring:', error);
	}

	// Example 4: Using tools
	console.log('\n=== Example 4: With Tools ===');
	try {
		const response4 = await chat.processRequest(
			{
				userMessage: 'Build the project and fix any errors',
				tools: ['terminal-execute', 'file-read-write'],
			},
			CancellationToken.None
		);

		console.log(`Response: ${response4.message}`);
		console.log(`Tool Results: ${JSON.stringify(response4.toolResults)}`);
	} catch (error) {
		console.error('Error with tools:', error);
	}

	// Example 5: Multi-turn conversation
	console.log('\n=== Example 5: Multi-turn Conversation ===');
	try {
		// First turn
		const response5a = await chat.processRequest(
			{
				userMessage: 'I need help writing a data processing pipeline',
			},
			CancellationToken.None
		);

		console.log(`Response 1: ${response5a.message}`);

		// Second turn (continues conversation)
		const response5b = await chat.processRequest(
			{
				userMessage: 'How would I handle errors in this pipeline?',
				templateId: 'code-generation',
			},
			CancellationToken.None
		);

		console.log(`Response 2: ${response5b.message}`);

		// Get conversation history
		const conversation = chat.getCurrentConversation();
		console.log(`\nConversation has ${conversation?.messages.length} messages`);
	} catch (error) {
		console.error('Error in multi-turn:', error);
	}

	// Example 6: Memory and history
	console.log('\n=== Example 6: Memory & History ===');
	try {
		const stats = chat.getMemoryStats();
		console.log(`Memory Stats: ${JSON.stringify(stats)}`);

		const history = chat.getHistory('user-message');
		console.log(`Recent user messages: ${history.length}`);
	} catch (error) {
		console.error('Error in memory:', error);
	}

	console.log('\n=== Examples Complete ===');
}

/**
 * Feature Overview:
 *
 * 1. **Conversation Management**
 *    - Multi-turn conversations with full history
 *    - Context awareness across turns
 *    - Conversation persistence and export
 *
 * 2. **Context Providers**
 *    - File context (current file, related files)
 *    - Symbol context (functions, classes, types)
 *    - Diagnostic context (errors, warnings)
 *    - Search results context
 *
 * 3. **Streaming Responses**
 *    - Real-time streaming of AI responses
 *    - Stream accumulation and management
 *    - Progress tracking
 *
 * 4. **Tool Integration**
 *    - File operations (read, write, create, delete)
 *    - Terminal execution
 *    - Code refactoring
 *    - Extensible tool system
 *
 * 5. **Prompt Templates**
 *    - Specialized templates for different tasks
 *    - Code generation, review, refactoring
 *    - Bug fixing, documentation, testing
 *    - Performance optimization, architecture design
 *
 * 6. **Memory Management**
 *    - Working memory for current context
 *    - TTL-based expiration
 *    - Tag-based organization
 *    - Memory statistics and cleanup
 *
 * 7. **Code Analysis**
 *    - Code quality assessment
 *    - Refactoring suggestions
 *    - Metrics calculation
 *    - Pattern detection
 *    - Improvement recommendations
 *
 * 8. **History Tracking**
 *    - Complete conversation history
 *    - Type-based history queries
 *    - Export/import capabilities
 *    - Recent context access
 */
