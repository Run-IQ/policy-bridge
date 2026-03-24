import { describe, it, expect, beforeEach } from 'vitest';
import { DGGraphGenerator } from '../../src/generators/DGGraphGenerator.js';
import {
  createPolicyNode,
  createPolicyGraph,
  createGraphMeta,
  createPolicyEdge,
  resetCounters,
  GT,
  VAR,
  CONST,
} from '../helpers.js';

describe('DGGraphGenerator', () => {
  const generator = new DGGraphGenerator();

  beforeEach(() => resetCounters());

  it('generates 1 compute node and no merge for single rule', () => {
    const node = createPolicyNode({
      id: 'rule_1',
      model: 'FLAT_RATE',
      condition: GT(VAR('income'), CONST(0)),
    });
    const graph = createPolicyGraph({ nodes: [node] });
    const meta = createGraphMeta();

    const result = generator.generate(graph, [node], meta, { tenantId: 't' });

    expect(Object.keys(result.nodes)).toHaveLength(1);
    expect(result.nodes['rule_1']).toBeDefined();
    expect(result.nodes['rule_1']!.type).toBe('compute');
    expect(result.nodes['merge_result']).toBeUndefined();
    expect(result.edges).toHaveLength(0);
  });

  it('generates compute nodes + merge node for 2+ rules', () => {
    const node1 = createPolicyNode({
      id: 'rule_1',
      model: 'FLAT_RATE',
      condition: GT(VAR('income'), CONST(0)),
    });
    const node2 = createPolicyNode({
      id: 'rule_2',
      model: 'PROGRESSIVE_BRACKET',
      condition: GT(VAR('income'), CONST(0)),
    });
    const graph = createPolicyGraph({ nodes: [node1, node2] });
    const meta = createGraphMeta();

    const result = generator.generate(graph, [node1, node2], meta, { tenantId: 't' });

    expect(Object.keys(result.nodes)).toHaveLength(3);
    expect(result.nodes['rule_1']!.type).toBe('compute');
    expect(result.nodes['rule_2']!.type).toBe('compute');
    expect(result.nodes['merge_result']!.type).toBe('merge');

    // 2 edges from compute nodes to merge
    const mergeEdges = result.edges.filter((e) => e.to.node === 'merge_result');
    expect(mergeEdges).toHaveLength(2);
  });

  it('creates DG edges from REQUIRES PolicyGraph edges', () => {
    const node1 = createPolicyNode({
      id: 'rule_1',
      model: 'FLAT_RATE',
      condition: GT(VAR('income'), CONST(0)),
    });
    const node2 = createPolicyNode({
      id: 'rule_2',
      model: 'PROGRESSIVE_BRACKET',
      condition: GT(VAR('income'), CONST(0)),
    });
    const edges = [createPolicyEdge({ from: 'rule_1', to: 'rule_2', type: 'REQUIRES' })];
    const graph = createPolicyGraph({ nodes: [node1, node2], edges });
    const meta = createGraphMeta();

    const result = generator.generate(graph, [node1, node2], meta, { tenantId: 't' });

    const requiresEdges = result.edges.filter((e) => e.id.startsWith('dg_'));
    expect(requiresEdges).toHaveLength(1);
    expect(requiresEdges[0]!.from.node).toBe('rule_1');
    expect(requiresEdges[0]!.to.node).toBe('rule_2');
  });
});
