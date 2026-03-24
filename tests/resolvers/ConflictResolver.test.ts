import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictResolver } from '../../src/resolvers/ConflictResolver.js';
import { CompilationError } from '../../src/errors.js';
import { createPolicyNode, createPolicyEdge, resetCounters, GT, VAR, CONST } from '../helpers.js';

describe('ConflictResolver', () => {
  const resolver = new ConflictResolver();

  beforeEach(() => resetCounters());

  it('suppresses node targeted by OVERRIDES edge', () => {
    const nodeA = createPolicyNode({
      id: 'node_a',
      model: 'FLAT_RATE',
      condition: GT(VAR('income'), CONST(0)),
    });
    const nodeB = createPolicyNode({
      id: 'node_b',
      model: 'FLAT_RATE',
      condition: GT(VAR('income'), CONST(0)),
    });

    const edges = [createPolicyEdge({ from: 'node_a', to: 'node_b', type: 'OVERRIDES' })];

    const result = resolver.resolve([nodeA, nodeB], edges);
    expect(result.activeNodes.map((n) => n.id)).toEqual(['node_a']);
    expect(result.suppressedNodes.map((n) => n.id)).toEqual(['node_b']);
  });

  it('handles cross-document OVERRIDES', () => {
    const nodeA = createPolicyNode({
      id: 'node_a',
      model: 'FLAT_RATE',
      condition: GT(VAR('income'), CONST(0)),
    });
    const nodeB = createPolicyNode({
      id: 'node_b',
      model: 'FLAT_RATE',
      condition: GT(VAR('income'), CONST(0)),
    });

    const edges = [
      createPolicyEdge({ from: 'node_a', to: 'node_b', type: 'OVERRIDES', crossDocument: true }),
    ];

    const result = resolver.resolve([nodeA, nodeB], edges);
    expect(result.activeNodes.map((n) => n.id)).toEqual(['node_a']);
    expect(result.suppressedNodes.map((n) => n.id)).toEqual(['node_b']);
  });

  it('throws CompilationError on OVERRIDES cycle', () => {
    const nodeA = createPolicyNode({ id: 'node_a', model: 'FLAT_RATE' });
    const nodeB = createPolicyNode({ id: 'node_b', model: 'FLAT_RATE' });

    const edges = [
      createPolicyEdge({ from: 'node_a', to: 'node_b', type: 'OVERRIDES' }),
      createPolicyEdge({ from: 'node_b', to: 'node_a', type: 'OVERRIDES' }),
    ];

    expect(() => resolver.resolve([nodeA, nodeB], edges)).toThrow(CompilationError);
    expect(() => resolver.resolve([nodeA, nodeB], edges)).toThrow('Cycle detected');
  });
});
