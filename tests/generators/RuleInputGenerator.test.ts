import { describe, it, expect, beforeEach } from 'vitest';
import { RuleInputGenerator } from '../../src/generators/RuleInputGenerator.js';
import { SchemaValidationError } from '../../src/errors.js';
import { createPolicyNode, createGraphMeta, resetCounters, GT, VAR, CONST } from '../helpers.js';

describe('RuleInputGenerator', () => {
  const generator = new RuleInputGenerator();

  beforeEach(() => resetCounters());

  it('generates RuleInput with correct model and params', () => {
    const node = createPolicyNode({
      id: 'rule_irpp',
      model: 'PROGRESSIVE_BRACKET',
      params: { base: 'income', brackets: [{ min: 0, max: 900000, rate: 0 }] },
      condition: GT(VAR('income'), CONST(0)),
      label: 'IRPP Togo 2025',
      priority: 10,
    });
    const meta = createGraphMeta();
    const compiledCondition = { '>': [{ var: 'income' }, 0] };

    const result = generator.generate(node, compiledCondition, meta, {
      tenantId: 'tenant-001',
      actor: 'test-user',
      effectiveFrom: '2025-01-01',
    });

    expect(result.model).toBe('PROGRESSIVE_BRACKET');
    expect(result.tenantId).toBe('tenant-001');
    expect(result.createdBy).toBe('test-user');
    expect(result.priority).toBe(10);
    expect(result.scope).toBe('tenant-specific');

    const payload = JSON.parse(result.payload);
    expect(payload.model).toBe('PROGRESSIVE_BRACKET');
    expect(payload.params.base).toBe('income');
    expect(payload.condition).toEqual({ dsl: 'jsonlogic', value: compiledCondition });
  });

  it('generates condition: { dsl: "jsonlogic", value: compiled } in payload', () => {
    const node = createPolicyNode({
      id: 'rule_tva',
      model: 'FLAT_RATE',
      params: { rate: 0.18, base: 'amount' },
      condition: GTE(VAR('amount'), CONST(0)),
    });
    const meta = createGraphMeta();
    const compiled = { '>=': [{ var: 'amount' }, 0] };

    const result = generator.generate(node, compiled, meta, { tenantId: 'tenant-001' });
    const payload = JSON.parse(result.payload);

    expect(payload.condition).toEqual({ dsl: 'jsonlogic', value: compiled });
  });

  it('throws SchemaValidationError when model is missing', () => {
    const node = createPolicyNode({
      id: 'bad_node',
      condition: GT(VAR('x'), CONST(0)),
    });
    const meta = createGraphMeta();

    expect(() =>
      generator.generate(node, { '>': [{ var: 'x' }, 0] }, meta, { tenantId: 't' }),
    ).toThrow(SchemaValidationError);
  });
});

function GTE(
  left: import('@run-iq/policy-dsl').PolicyValue,
  right: import('@run-iq/policy-dsl').PolicyValue,
): import('@run-iq/policy-dsl').PolicyExpression {
  return { type: 'GTE', left, right };
}
