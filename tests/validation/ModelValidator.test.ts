import { describe, it, expect, beforeEach } from 'vitest';
import { ModelValidator } from '../../src/validation/ModelValidator.js';
import {
  createPolicyNode,
  createMockRegistry,
  createMockModel,
  resetCounters,
  GT,
  VAR,
  CONST,
} from '../helpers.js';

describe('ModelValidator', () => {
  beforeEach(() => resetCounters());

  it('returns invalid NO_MODEL_DECLARED when node has no model', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const validator = new ModelValidator(registry);
    const node = createPolicyNode({ condition: GT(VAR('income'), CONST(0)) });

    const result = validator.validate(node);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('NO_MODEL_DECLARED');
    expect(result.needsHumanReview).toBe(true);
  });

  it('returns invalid NO_MODEL_DECLARED when model is UNKNOWN', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const validator = new ModelValidator(registry);
    const node = createPolicyNode({ model: 'UNKNOWN', condition: GT(VAR('income'), CONST(0)) });

    const result = validator.validate(node);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('NO_MODEL_DECLARED');
  });

  it('returns invalid MODEL_NOT_IN_REGISTRY when model not registered', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const validator = new ModelValidator(registry);
    const node = createPolicyNode({
      model: 'PROGRESSIVE_BRACKET',
      params: { base: 'income' },
      condition: GT(VAR('income'), CONST(0)),
    });

    const result = validator.validate(node);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MODEL_NOT_IN_REGISTRY');
  });

  it('returns invalid INVALID_PARAMS when params fail validation', () => {
    const registry = createMockRegistry([
      createMockModel('FLAT_RATE', { valid: false, errors: ['rate must be between 0 and 1'] }),
    ]);
    const validator = new ModelValidator(registry);
    const node = createPolicyNode({
      model: 'FLAT_RATE',
      params: { rate: 5 },
      condition: GT(VAR('income'), CONST(0)),
    });

    const result = validator.validate(node);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_PARAMS');
    expect(result.errors).toContain('rate must be between 0 and 1');
  });

  it('returns valid with warning when params are absent', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE')]);
    const validator = new ModelValidator(registry);
    const node = createPolicyNode({
      model: 'FLAT_RATE',
      // params intentionally omitted
      condition: GT(VAR('income'), CONST(0)),
    });

    const result = validator.validate(node);
    expect(result.valid).toBe(true);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('no params');
  });

  it('returns valid when model and params are correct', () => {
    const registry = createMockRegistry([createMockModel('FLAT_RATE', { valid: true })]);
    const validator = new ModelValidator(registry);
    const node = createPolicyNode({
      model: 'FLAT_RATE',
      params: { rate: 0.1, base: 'income' },
      condition: GT(VAR('income'), CONST(0)),
    });

    const result = validator.validate(node);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.warning).toBeUndefined();
  });
});
