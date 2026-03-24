import { describe, it, expect, beforeEach } from 'vitest';
import { RuleRefResolver } from '../../src/resolvers/RuleRefResolver.js';
import { CycleError, UnresolvableReferenceError } from '../../src/errors.js';
import { createPolicyNode, resetCounters, GT, VAR, CONST, RULE_REF, AND } from '../helpers.js';

describe('RuleRefResolver', () => {
  const resolver = new RuleRefResolver();

  beforeEach(() => resetCounters());

  it('inlines a valid RULE_REF', () => {
    const nodeA = createPolicyNode({
      id: 'node_a',
      condition: GT(VAR('income'), CONST(0)),
      model: 'FLAT_RATE',
    });
    const nodeB = createPolicyNode({
      id: 'node_b',
      condition: AND(RULE_REF('node_a'), GT(VAR('amount'), CONST(100))),
      model: 'FLAT_RATE',
    });

    const resolved = resolver.resolve([nodeA, nodeB]);
    const resolvedB = resolved.find((n) => n.id === 'node_b')!;

    expect(resolvedB.condition).toEqual(
      AND(GT(VAR('income'), CONST(0)), GT(VAR('amount'), CONST(100))),
    );
  });

  it('throws CycleError on circular RULE_REF', () => {
    const nodeA = createPolicyNode({
      id: 'node_a',
      condition: RULE_REF('node_b'),
      model: 'FLAT_RATE',
    });
    const nodeB = createPolicyNode({
      id: 'node_b',
      condition: RULE_REF('node_a'),
      model: 'FLAT_RATE',
    });

    expect(() => resolver.resolve([nodeA, nodeB])).toThrow(CycleError);
  });

  it('throws UnresolvableReferenceError when referenced node not found', () => {
    const node = createPolicyNode({
      id: 'node_a',
      condition: RULE_REF('nonexistent'),
      model: 'FLAT_RATE',
    });

    expect(() => resolver.resolve([node])).toThrow(UnresolvableReferenceError);
  });
});
