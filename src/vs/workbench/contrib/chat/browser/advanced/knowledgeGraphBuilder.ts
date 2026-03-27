/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Shadow. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';

export interface IKnowledgeNode {
	id: string;
	type: 'class' | 'function' | 'interface' | 'variable' | 'module' | 'file' | 'concept';
	label: string;
	description?: string;
	file?: string;
	line?: number;
	metadata?: Record<string, unknown>;
}

export interface IKnowledgeEdge {
	sourceId: string;
	targetId: string;
	type: 'uses' | 'implements' | 'extends' | 'depends' | 'calls' | 'defines' | 'related';
	weight: number; // 0-1, strength of relationship
	metadata?: Record<string, unknown>;
}

export interface IKnowledgeQuery {
	query: string;
	nodeTypes?: string[];
	maxDepth?: number;
	limit?: number;
}

export interface IPathQuery {
	sourceId: string;
	targetId: string;
	maxDistance?: number;
}

/**
 * Knowledge Graph Builder - Build semantic understanding of codebase
 *
 * Supports:
 * - Node/edge management
 * - Graph traversal and path finding
 * - Semantic queries
 * - Community detection
 * - Centrality analysis
 */
export class KnowledgeGraphBuilder extends Disposable {
	private _nodes = new Map<string, IKnowledgeNode>();
	private _edges: IKnowledgeEdge[] = [];
	private _adjacencyList = new Map<string, string[]>();
	private _onNodeAdded = new Emitter<IKnowledgeNode>();
	private _onEdgeAdded = new Emitter<IKnowledgeEdge>();

	readonly onNodeAdded: Event<IKnowledgeNode> = this._onNodeAdded.event;
	readonly onEdgeAdded: Event<IKnowledgeEdge> = this._onEdgeAdded.event;

	constructor() {
		super();
		this._register(this._onNodeAdded);
		this._register(this._onEdgeAdded);
	}

	/**
	 * Add a node to the graph
	 */
	addNode(node: IKnowledgeNode): void {
		this._nodes.set(node.id, node);
		if (!this._adjacencyList.has(node.id)) {
			this._adjacencyList.set(node.id, []);
		}
		this._onNodeAdded.fire(node);
	}

	/**
	 * Add an edge to the graph
	 */
	addEdge(edge: IKnowledgeEdge): void {
		// Ensure both nodes exist
		if (!this._nodes.has(edge.sourceId) || !this._nodes.has(edge.targetId)) {
			return; // Skip if nodes don't exist
		}

		this._edges.push(edge);
		const adjacentNodes = this._adjacencyList.get(edge.sourceId);
		if (adjacentNodes && !adjacentNodes.includes(edge.targetId)) {
			adjacentNodes.push(edge.targetId);
		}

		this._onEdgeAdded.fire(edge);
	}

	/**
	 * Get a node by ID
	 */
	getNode(id: string): IKnowledgeNode | undefined {
		return this._nodes.get(id);
	}

	/**
	 * Get all nodes of a specific type
	 */
	getNodesByType(type: string): IKnowledgeNode[] {
		return Array.from(this._nodes.values()).filter(n => n.type === type);
	}

	/**
	 * Get edges for a node
	 */
	getEdges(nodeId?: string, edgeType?: string): IKnowledgeEdge[] {
		if (!nodeId) {
			return edgeType ? this._edges.filter(e => e.type === edgeType) : this._edges;
		}

		const filtered = this._edges.filter(e => e.sourceId === nodeId || e.targetId === nodeId);
		return edgeType ? filtered.filter(e => e.type === edgeType) : filtered;
	}

	/**
	 * Find shortest path between two nodes
	 */
	findShortestPath(query: IPathQuery): string[] {
		const { sourceId, targetId, maxDistance = 5 } = query;

		if (!this._nodes.has(sourceId) || !this._nodes.has(targetId)) {
			return [];
		}

		if (sourceId === targetId) {
			return [sourceId];
		}

		const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: sourceId, path: [sourceId] }];
		const visited = new Set<string>([sourceId]);

		while (queue.length > 0) {
			const { nodeId, path } = queue.shift()!;

			if (path.length >= maxDistance + 1) {
				continue;
			}

			const adjacent = this._adjacencyList.get(nodeId) ?? [];
			for (const nextNodeId of adjacent) {
				if (!visited.has(nextNodeId)) {
					const newPath = [...path, nextNodeId];

					if (nextNodeId === targetId) {
						return newPath;
					}

					visited.add(nextNodeId);
					queue.push({ nodeId: nextNodeId, path: newPath });
				}
			}
		}

		return [];
	}

	/**
	 * Find all nodes related to a query
	 */
	searchGraph(query: IKnowledgeQuery): IKnowledgeNode[] {
		const { query: queryStr, nodeTypes, limit = 50 } = query;

		const queryWords = queryStr.toLowerCase().split(/\s+/);
		const results: IKnowledgeNode[] = [];
		const seen = new Set<string>();

		for (const node of this._nodes.values()) {
			// Check type filter
			if (nodeTypes && !nodeTypes.includes(node.type)) {
				continue;
			}

			// Check if matches query
			const label = node.label.toLowerCase();
			const description = (node.description ?? '').toLowerCase();

			const matchScore = queryWords.filter(w => label.includes(w) || description.includes(w)).length;
			if (matchScore > 0 && !seen.has(node.id)) {
				results.push(node);
				seen.add(node.id);

				if (results.length >= limit) {
					break;
				}
			}
		}

		return results.sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0));
	}

	/**
	 * Get related nodes (outgoing edges)
	 */
	getRelatedNodes(nodeId: string, edgeType?: string, depth: number = 1): IKnowledgeNode[] {
		const results: IKnowledgeNode[] = [];
		const visited = new Set<string>([nodeId]);
		const queue: Array<{ id: string; currentDepth: number }> = [{ id: nodeId, currentDepth: 0 }];

		while (queue.length > 0) {
			const { id, currentDepth } = queue.shift()!;

			if (currentDepth > 0) {
				const node = this.getNode(id);
				if (node && !results.includes(node)) {
					results.push(node);
				}
			}

			if (currentDepth < depth) {
				const adjacent = this._adjacencyList.get(id) ?? [];
				for (const nextId of adjacent) {
					if (!visited.has(nextId)) {
						visited.add(nextId);
						queue.push({ id: nextId, currentDepth: currentDepth + 1 });
					}
				}
			}
		}

		return results;
	}

	/**
	 * Calculate node centrality (importance)
	 */
	calculateCentrality(): Map<string, number> {
		const centralityScores = new Map<string, number>();

		// Simple: count incoming + outgoing edges
		for (const node of this._nodes.values()) {
			const incomingEdges = this._edges.filter(e => e.targetId === node.id).length;
			const outgoingEdges = this._edges.filter(e => e.sourceId === node.id).length;
			const score = incomingEdges + outgoingEdges;
			centralityScores.set(node.id, score);
		}

		return centralityScores;
	}

	/**
	 * Find highly connected clusters
	 */
	findClusters(): Array<Set<string>> {
		const clusters: Array<Set<string>> = [];
		const visited = new Set<string>();

		for (const nodeId of this._nodes.keys()) {
			if (!visited.has(nodeId)) {
				const cluster = this._dfs(nodeId, visited);
				if (cluster.size > 1) {
					clusters.push(cluster);
				}
			}
		}

		return clusters;
	}

	/**
	 * Export graph as JSON
	 */
	export(): { nodes: IKnowledgeNode[]; edges: IKnowledgeEdge[] } {
		return {
			nodes: Array.from(this._nodes.values()),
			edges: this._edges
		};
	}

	/**
	 * Import from JSON
	 */
	import(data: { nodes: IKnowledgeNode[]; edges: IKnowledgeEdge[] }): void {
		this._nodes.clear();
		this._edges = [];
		this._adjacencyList.clear();

		for (const node of data.nodes) {
			this.addNode(node);
		}

		for (const edge of data.edges) {
			this.addEdge(edge);
		}
	}

	/**
	 * Get graph statistics
	 */
	getStats(): {
		nodeCount: number;
		edgeCount: number;
		averageDegree: number;
		density: number;
		mostCentralNode: { id: string; score: number } | undefined;
	} {
		const nodeCount = this._nodes.size;
		const edgeCount = this._edges.length;
		const averageDegree = nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;
		const maxPossibleEdges = nodeCount * (nodeCount - 1);
		const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

		let mostCentral: { id: string; score: number } | undefined;
		const centrality = this.calculateCentrality();
		for (const [id, score] of centrality) {
			if (!mostCentral || score > mostCentral.score) {
				mostCentral = { id, score };
			}
		}

		return { nodeCount, edgeCount, averageDegree, density, mostCentralNode: mostCentral };
	}

	/**
	 * Clear all nodes and edges
	 */
	clear(): void {
		this._nodes.clear();
		this._edges = [];
		this._adjacencyList.clear();
	}

	private _dfs(startId: string, visited: Set<string>): Set<string> {
		const cluster = new Set<string>();
		const stack: string[] = [startId];

		while (stack.length > 0) {
			const nodeId = stack.pop()!;

			if (visited.has(nodeId)) {
				continue;
			}

			visited.add(nodeId);
			cluster.add(nodeId);

			const adjacent = this._adjacencyList.get(nodeId) ?? [];
			for (const nextId of adjacent) {
				if (!visited.has(nextId)) {
					stack.push(nextId);
				}
			}
		}

		return cluster;
	}

	override dispose(): void {
		this._onNodeAdded.dispose();
		this._onEdgeAdded.dispose();
		super.dispose();
	}
}
