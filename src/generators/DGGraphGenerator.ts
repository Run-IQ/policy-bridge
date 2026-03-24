import type { PolicyGraph, PolicyGraphMeta, PolicyNode } from '@run-iq/policy-dsl';
import type { DGGraph, DGNode, DGEdge } from '@run-iq/dg';
import { PolicyGraphNavigator } from '@run-iq/policy-graph';

export class DGGraphGenerator {
  generate(
    graph: PolicyGraph,
    ruleNodes: PolicyNode[],
    graphMeta: PolicyGraphMeta,
    _options: { tenantId: string },
  ): DGGraph {
    const navigator = new PolicyGraphNavigator(graph);
    const dgNodes: Record<string, DGNode> = {};
    const dgEdges: DGEdge[] = [];

    for (const node of ruleNodes) {
      dgNodes[node.id] = this.createComputeNode(node);
    }

    if (ruleNodes.length > 1) {
      const merge = this.createMergeNode(ruleNodes);
      dgNodes[merge.id] = merge;
      for (const node of ruleNodes) {
        dgEdges.push({
          id: `edge_${node.id}_merge`,
          from: { node: node.id, port: node.action?.output ?? 'result' },
          to: { node: merge.id, port: node.action?.output ?? 'result' },
        });
      }
    }

    for (const edge of navigator.getEdgesByType('REQUIRES')) {
      if (dgNodes[edge.from] && dgNodes[edge.to]) {
        dgEdges.push({
          id: `dg_${edge.id}`,
          from: { node: edge.from, port: 'result' },
          to: { node: edge.to, port: 'dependency' },
        });
      }
    }

    return {
      id: `dg-${graphMeta.id}`,
      version: '1-0-0',
      nodes: dgNodes,
      edges: dgEdges,
      meta: {
        description: `Generated from PolicyGraph "${graphMeta.title}"`,
        domain: graphMeta.domain,
        author: 'policy-bridge',
        tags: [`policy-graph:${graphMeta.id}`],
      },
    };
  }

  private createComputeNode(node: PolicyNode): DGNode {
    const output = node.action?.output ?? 'result';
    return {
      id: node.id,
      type: 'compute',
      model: node.model!,
      ports: {
        in: [{ name: 'input', required: true }],
        out: [{ name: output, required: true }],
      },
      policy: {
        onError: 'fallback',
        onFailPropagation: 'continue',
        fallback: { [output]: null },
      },
    };
  }

  private createMergeNode(nodes: PolicyNode[]): DGNode {
    return {
      id: 'merge_result',
      type: 'merge',
      ports: {
        in: nodes.map((n) => ({ name: n.action?.output ?? 'result', required: false })),
        out: [{ name: 'finalResult', required: true }],
      },
      policy: { onError: 'fail', onFailPropagation: 'halt' },
      meta: { mergeConfig: { strategy: 'wait-all', onPartialInputs: 'use-defaults' } },
    };
  }
}
