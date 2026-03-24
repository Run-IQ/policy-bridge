import type { PolicyExpression, PolicyValue } from '@run-iq/policy-dsl';
import type { JSONLogicExpression } from '../types.js';
import { CompilationError, UnsupportedOperatorError } from '../errors.js';

export class ExpressionCompiler {
  compile(expr: PolicyExpression): JSONLogicExpression {
    return this.compileExpr(expr);
  }

  private compileExpr(expr: PolicyExpression): JSONLogicExpression {
    switch (expr.type) {
      case 'AND':
        return { and: [this.compileExpr(expr.left), this.compileExpr(expr.right)] };
      case 'OR':
        return { or: [this.compileExpr(expr.left), this.compileExpr(expr.right)] };
      case 'NOT':
        return { '!': [this.compileExpr(expr.expr)] };

      case 'GT':
        return { '>': [this.compileValue(expr.left), this.compileValue(expr.right)] };
      case 'GTE':
        return { '>=': [this.compileValue(expr.left), this.compileValue(expr.right)] };
      case 'LT':
        return { '<': [this.compileValue(expr.left), this.compileValue(expr.right)] };
      case 'LTE':
        return { '<=': [this.compileValue(expr.left), this.compileValue(expr.right)] };
      case 'EQ':
        return { '==': [this.compileValue(expr.left), this.compileValue(expr.right)] };
      case 'NEQ':
        return { '!=': [this.compileValue(expr.left), this.compileValue(expr.right)] };

      case 'BETWEEN':
        return {
          and: [
            { '>=': [this.compileValue(expr.value), this.compileValue(expr.min)] },
            { '<=': [this.compileValue(expr.value), this.compileValue(expr.max)] },
          ],
        };

      case 'IN':
        return { in: [this.compileValue(expr.value), expr.set.map((v) => this.compileValue(v))] };

      case 'NOT_IN':
        return {
          '!': [{ in: [this.compileValue(expr.value), expr.set.map((v) => this.compileValue(v))] }],
        };

      case 'BEFORE':
        return { date_before: [this.compileValue(expr.value), this.compileValue(expr.date)] };

      case 'AFTER':
        return { date_after: [this.compileValue(expr.value), this.compileValue(expr.date)] };

      case 'EXISTS':
        return { '!!': [{ var: expr.variable }] };

      case 'MISSING':
        return { '!': [{ var: expr.variable }] };

      case 'RULE_REF':
        throw new CompilationError(
          `RULE_REF "${expr.ruleId}" was not resolved before compilation. ` +
            `RuleRefResolver must run before ExpressionCompiler.`,
        );

      default:
        throw new UnsupportedOperatorError(
          `Operator "${(expr as { type: string }).type}" is not supported in PolicyDSL v1. ` +
            `This node should have been flagged by PolicyValidator. ` +
            `It will be supported in v2 (ANY, ALL, COUNT, WITHIN) or v3 (COMPUTED).`,
        );
    }
  }

  private compileValue(value: PolicyValue): unknown {
    switch (value.type) {
      case 'VAR':
        return { var: value.path };
      case 'CONST':
        return value.value;
    }
  }
}
