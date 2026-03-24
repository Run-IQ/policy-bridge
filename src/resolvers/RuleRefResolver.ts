import type { PolicyExpression, PolicyNode } from '@run-iq/policy-dsl';
import { CycleError, UnresolvableReferenceError } from '../errors.js';

export class RuleRefResolver {
  resolve(nodes: PolicyNode[]): PolicyNode[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return nodes.map((node) => {
      if (!node.condition || !this.hasRuleRef(node.condition)) return node;
      const resolved = this.resolveExpr(node.condition, nodeMap, new Set([node.id]));
      return { ...node, condition: resolved };
    });
  }

  private resolveExpr(
    expr: PolicyExpression,
    nodes: Map<string, PolicyNode>,
    visited: Set<string>,
  ): PolicyExpression {
    if (expr.type === 'RULE_REF') {
      if (visited.has(expr.ruleId)) {
        throw new CycleError(`Circular RULE_REF: "${expr.ruleId}" creates a cycle`);
      }
      const ref = nodes.get(expr.ruleId);
      if (!ref?.condition) {
        throw new UnresolvableReferenceError(
          `RULE_REF "${expr.ruleId}" not found or has no condition`,
        );
      }
      visited.add(expr.ruleId);
      return this.resolveExpr(ref.condition, nodes, new Set(visited));
    }

    if (expr.type === 'AND' || expr.type === 'OR') {
      return {
        ...expr,
        left: this.resolveExpr(expr.left, nodes, visited),
        right: this.resolveExpr(expr.right, nodes, visited),
      };
    }
    if (expr.type === 'NOT') {
      return { ...expr, expr: this.resolveExpr(expr.expr, nodes, visited) };
    }

    return expr;
  }

  private hasRuleRef(expr: PolicyExpression): boolean {
    if (expr.type === 'RULE_REF') return true;
    if (expr.type === 'AND' || expr.type === 'OR') {
      return this.hasRuleRef(expr.left) || this.hasRuleRef(expr.right);
    }
    if (expr.type === 'NOT') return this.hasRuleRef(expr.expr);
    return false;
  }
}
