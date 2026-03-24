import { describe, it, expect, beforeEach } from 'vitest';
import { PreflightChecker } from '../src/PreflightChecker.js';
import {
  createPolicyGraph,
  createPolicyNode,
  createMockRegistry,
  createMockModel,
  resetCounters,
  GT,
  VAR,
  CONST,
  RULE_REF,
} from './helpers.js';

describe('PreflightChecker', () => {
  beforeEach(() => resetCounters());

  it('returns fatal WRONG_MODE for standalone graph', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const checker = new PreflightChecker(registry);
    const graph = createPolicyGraph({ meta: { mode: 'standalone' } });

    const report = checker.check(graph);
    expect(report.passedPreflight).toBe(false);
    expect(report.issues.some((i) => i.code === 'WRONG_MODE' && i.severity === 'fatal')).toBe(true);
  });

  it('returns fatal NO_MODEL for node without model', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const checker = new PreflightChecker(registry);
    const node = createPolicyNode({
      id: 'no_model_node',
      condition: GT(VAR('x'), CONST(0)),
    });
    const graph = createPolicyGraph({ nodes: [node] });

    const report = checker.check(graph);
    expect(report.passedPreflight).toBe(false);
    expect(report.issues.some((i) => i.code === 'NO_MODEL' && i.nodeId === 'no_model_node')).toBe(
      true,
    );
  });

  it('passes preflight for clean Mode 2 graph', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const checker = new PreflightChecker(registry);
    const node = createPolicyNode({
      id: 'good_node',
      model: 'FLAT_RATE',
      params: { rate: 0.1, base: 'income' },
      condition: GT(VAR('income'), CONST(0)),
      confidence: 0.95,
    });
    const graph = createPolicyGraph({ nodes: [node] });

    const report = checker.check(graph);
    expect(report.passedPreflight).toBe(true);
    expect(report.fatal).toBe(0);
  });

  it('returns fatal RULE_REF_CYCLE for circular references', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const checker = new PreflightChecker(registry);
    const nodeA = createPolicyNode({
      id: 'node_a',
      model: 'FLAT_RATE',
      params: { rate: 0.1 },
      condition: RULE_REF('node_b'),
    });
    const nodeB = createPolicyNode({
      id: 'node_b',
      model: 'FLAT_RATE',
      params: { rate: 0.2 },
      condition: RULE_REF('node_a'),
    });
    const graph = createPolicyGraph({ nodes: [nodeA, nodeB] });

    const report = checker.check(graph);
    expect(report.passedPreflight).toBe(false);
    expect(report.issues.some((i) => i.code === 'RULE_REF_CYCLE')).toBe(true);
  });

  it('returns warning for low confidence node (not fatal)', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const checker = new PreflightChecker(registry);
    const node = createPolicyNode({
      id: 'low_conf',
      model: 'FLAT_RATE',
      params: { rate: 0.1 },
      condition: GT(VAR('income'), CONST(0)),
      confidence: 0.5,
    });
    const graph = createPolicyGraph({ nodes: [node] });

    const report = checker.check(graph);
    // Low confidence is a warning, not fatal — still passes preflight
    expect(report.passedPreflight).toBe(true);
    expect(report.issues.some((i) => i.code === 'LOW_CONFIDENCE' && i.severity === 'warning')).toBe(
      true,
    );
  });
});
