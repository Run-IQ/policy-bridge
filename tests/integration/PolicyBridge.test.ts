import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyBridge } from '../../src/PolicyBridge.js';
import { CompilationError } from '../../src/errors.js';
import {
  createPolicyGraph,
  createPolicyNode,
  createPolicyEdge,
  createMockRegistry,
  createMockModel,
  resetCounters,
  GT,
  VAR,
  CONST,
} from '../helpers.js';

describe('PolicyBridge — integration', () => {
  beforeEach(() => resetCounters());

  it('compiles a complete Mode 2 graph into CompilationResult', () => {
    const registry = createMockRegistry([
      createMockModel('FLAT_RATE'),
      createMockModel('PROGRESSIVE_BRACKET'),
    ]);
    const bridge = new PolicyBridge(registry, { forceCompile: true });

    const node1 = createPolicyNode({
      id: 'tva_rule',
      model: 'FLAT_RATE',
      params: { rate: 0.18, base: 'amount' },
      condition: GT(VAR('amount'), CONST(0)),
      label: 'TVA 18%',
      confidence: 0.95,
    });
    const node2 = createPolicyNode({
      id: 'irpp_rule',
      model: 'PROGRESSIVE_BRACKET',
      params: { base: 'income', brackets: [] },
      condition: GT(VAR('income'), CONST(0)),
      label: 'IRPP progressif',
      confidence: 0.92,
    });
    const graph = createPolicyGraph({ nodes: [node1, node2] });

    const result = bridge.compile(graph, {
      tenantId: 'tenant-001',
      effectiveFrom: '2025-01-01',
    });

    expect(result.rules).toHaveLength(2);
    expect(result.dgGraph).toBeDefined();
    expect(result.dgGraph.nodes['tva_rule']).toBeDefined();
    expect(result.dgGraph.nodes['irpp_rule']).toBeDefined();
    expect(result.dgGraph.nodes['merge_result']).toBeDefined();
    expect(result.report.compiled).toBe(2);
    expect(result.report.readyForRegistry).toBe(true);
  });

  it('throws CompilationError for standalone mode graph', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const bridge = new PolicyBridge(registry);
    const graph = createPolicyGraph({ meta: { mode: 'standalone' } });

    expect(() => bridge.compile(graph, { tenantId: 'tenant-001' })).toThrow(CompilationError);
  });

  it('reports suppressed nodes from OVERRIDES edges', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const bridge = new PolicyBridge(registry, { forceCompile: true });

    const node1 = createPolicyNode({
      id: 'new_rule',
      model: 'FLAT_RATE',
      params: { rate: 0.2, base: 'income' },
      condition: GT(VAR('income'), CONST(0)),
      confidence: 0.95,
    });
    const node2 = createPolicyNode({
      id: 'old_rule',
      model: 'FLAT_RATE',
      params: { rate: 0.15, base: 'income' },
      condition: GT(VAR('income'), CONST(0)),
      confidence: 0.95,
    });
    const edges = [createPolicyEdge({ from: 'new_rule', to: 'old_rule', type: 'OVERRIDES' })];
    const graph = createPolicyGraph({ nodes: [node1, node2], edges });

    const result = bridge.compile(graph, { tenantId: 'tenant-001', effectiveFrom: '2025-01-01' });

    expect(result.report.suppressedNodes).toContain('old_rule');
    expect(result.report.suppressed).toBe(1);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]!.model).toBe('FLAT_RATE');
  });

  it('skips nodes below confidence threshold', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const bridge = new PolicyBridge(registry, { forceCompile: true });

    const goodNode = createPolicyNode({
      id: 'good',
      model: 'FLAT_RATE',
      params: { rate: 0.1 },
      condition: GT(VAR('income'), CONST(0)),
      confidence: 0.95,
    });
    const lowNode = createPolicyNode({
      id: 'low',
      model: 'FLAT_RATE',
      params: { rate: 0.2 },
      condition: GT(VAR('income'), CONST(0)),
      confidence: 0.5,
    });
    const graph = createPolicyGraph({ nodes: [goodNode, lowNode] });

    const result = bridge.compile(graph, {
      tenantId: 'tenant-001',
      effectiveFrom: '2025-01-01',
      confidenceThreshold: 0.8,
    });

    expect(result.rules).toHaveLength(1);
    expect(result.report.skippedNodes).toContain('low');
    expect(result.report.skipped).toBe(1);
  });

  it('sets readyForRegistry: true when errors = 0', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const bridge = new PolicyBridge(registry, { forceCompile: true });

    const node = createPolicyNode({
      id: 'rule_ok',
      model: 'FLAT_RATE',
      params: { rate: 0.1 },
      condition: GT(VAR('income'), CONST(0)),
      confidence: 0.95,
    });
    const graph = createPolicyGraph({ nodes: [node] });

    const result = bridge.compile(graph, { tenantId: 't', effectiveFrom: '2025-01-01' });

    expect(result.report.errors).toBe(0);
    expect(result.report.readyForRegistry).toBe(true);
  });
});
