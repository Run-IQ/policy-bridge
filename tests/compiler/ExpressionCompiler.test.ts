import { describe, it, expect } from 'vitest';
import { ExpressionCompiler } from '../../src/compiler/ExpressionCompiler.js';
import { CompilationError, UnsupportedOperatorError } from '../../src/errors.js';
import {
  AND,
  OR,
  NOT,
  GT,
  GTE,
  LT,
  LTE,
  EQ,
  NEQ,
  BETWEEN,
  IN,
  NOT_IN,
  BEFORE,
  AFTER,
  EXISTS,
  MISSING,
  RULE_REF,
  VAR,
  CONST,
} from '../helpers.js';

describe('ExpressionCompiler', () => {
  const compiler = new ExpressionCompiler();

  it('compiles AND correctly', () => {
    const expr = AND(GT(VAR('income'), CONST(0)), LT(VAR('income'), CONST(100000)));
    const result = compiler.compile(expr);
    expect(result).toEqual({
      and: [{ '>': [{ var: 'income' }, 0] }, { '<': [{ var: 'income' }, 100000] }],
    });
  });

  it('compiles OR correctly', () => {
    const expr = OR(EQ(VAR('status'), CONST('active')), EQ(VAR('status'), CONST('pending')));
    const result = compiler.compile(expr);
    expect(result).toEqual({
      or: [{ '==': [{ var: 'status' }, 'active'] }, { '==': [{ var: 'status' }, 'pending'] }],
    });
  });

  it('compiles NOT correctly', () => {
    const expr = NOT(EQ(VAR('exempt'), CONST(true)));
    const result = compiler.compile(expr);
    expect(result).toEqual({
      '!': [{ '==': [{ var: 'exempt' }, true] }],
    });
  });

  it('compiles GT/GTE/LT/LTE/EQ/NEQ correctly', () => {
    expect(compiler.compile(GT(VAR('a'), CONST(10)))).toEqual({ '>': [{ var: 'a' }, 10] });
    expect(compiler.compile(GTE(VAR('a'), CONST(10)))).toEqual({ '>=': [{ var: 'a' }, 10] });
    expect(compiler.compile(LT(VAR('a'), CONST(10)))).toEqual({ '<': [{ var: 'a' }, 10] });
    expect(compiler.compile(LTE(VAR('a'), CONST(10)))).toEqual({ '<=': [{ var: 'a' }, 10] });
    expect(compiler.compile(EQ(VAR('a'), CONST(10)))).toEqual({ '==': [{ var: 'a' }, 10] });
    expect(compiler.compile(NEQ(VAR('a'), CONST(10)))).toEqual({ '!=': [{ var: 'a' }, 10] });
  });

  it('compiles BETWEEN → { and: [>=, <=] }', () => {
    const expr = BETWEEN(VAR('income'), CONST(0), CONST(100000));
    const result = compiler.compile(expr);
    expect(result).toEqual({
      and: [{ '>=': [{ var: 'income' }, 0] }, { '<=': [{ var: 'income' }, 100000] }],
    });
  });

  it('compiles IN correctly', () => {
    const expr = IN(VAR('country'), [CONST('TG'), CONST('BJ'), CONST('GH')]);
    const result = compiler.compile(expr);
    expect(result).toEqual({
      in: [{ var: 'country' }, ['TG', 'BJ', 'GH']],
    });
  });

  it('compiles NOT_IN correctly', () => {
    const expr = NOT_IN(VAR('status'), [CONST('archived'), CONST('deleted')]);
    const result = compiler.compile(expr);
    expect(result).toEqual({
      '!': [{ in: [{ var: 'status' }, ['archived', 'deleted']] }],
    });
  });

  it('compiles BEFORE → { date_before: [v, d] }', () => {
    const expr = BEFORE(VAR('start_date'), CONST(1706745600000));
    const result = compiler.compile(expr);
    expect(result).toEqual({
      date_before: [{ var: 'start_date' }, 1706745600000],
    });
  });

  it('compiles AFTER → { date_after: [v, d] }', () => {
    const expr = AFTER(VAR('end_date'), CONST(1706745600000));
    const result = compiler.compile(expr);
    expect(result).toEqual({
      date_after: [{ var: 'end_date' }, 1706745600000],
    });
  });

  it('compiles EXISTS → { !!: [{ var }] }', () => {
    const result = compiler.compile(EXISTS('tax_id'));
    expect(result).toEqual({ '!!': [{ var: 'tax_id' }] });
  });

  it('compiles MISSING → { !: [{ var }] }', () => {
    const result = compiler.compile(MISSING('exemption'));
    expect(result).toEqual({ '!': [{ var: 'exemption' }] });
  });

  it('throws CompilationError on unresolved RULE_REF', () => {
    expect(() => compiler.compile(RULE_REF('some_rule'))).toThrow(CompilationError);
    expect(() => compiler.compile(RULE_REF('some_rule'))).toThrow('was not resolved');
  });

  it('throws UnsupportedOperatorError on unknown operator', () => {
    const badExpr = {
      type: 'COMPUTED',
      value: 'x',
    } as unknown as import('@run-iq/policy-dsl').PolicyExpression;
    expect(() => compiler.compile(badExpr)).toThrow(UnsupportedOperatorError);
    expect(() => compiler.compile(badExpr)).toThrow('not supported in PolicyDSL v1');
  });
});
