import type { PolicyEdge, PolicyNode } from '@run-iq/policy-dsl';
import type { ConflictResolutionResult } from '../types.js';
import { CompilationError } from '../errors.js';

export class ConflictResolver {
  resolve(nodes: PolicyNode[], edges: PolicyEdge[]): ConflictResolutionResult {
    const suppressed = new Set<string>();
    const overrideEdges = edges.filter((e) => e.type === 'OVERRIDES');

    if (this.hasOverrideCycle(overrideEdges)) {
      throw new CompilationError('Cycle detected in OVERRIDES edges');
    }

    for (const edge of overrideEdges) {
      suppressed.add(edge.to);
    }

    return {
      activeNodes: nodes.filter((n) => !suppressed.has(n.id)),
      suppressedNodes: nodes.filter((n) => suppressed.has(n.id)),
    };
  }

  private hasOverrideCycle(edges: PolicyEdge[]): boolean {
    const graph = new Map<string, string[]>();
    for (const edge of edges) {
      if (!graph.has(edge.from)) graph.set(edge.from, []);
      graph.get(edge.from)!.push(edge.to);
    }
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      inStack.add(node);
      for (const n of graph.get(node) ?? []) {
        if (!visited.has(n) && dfs(n)) return true;
        if (inStack.has(n)) return true;
      }
      inStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node) && dfs(node)) return true;
    }
    return false;
  }
}
