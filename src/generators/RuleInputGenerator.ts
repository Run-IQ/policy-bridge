import type { PolicyGraphMeta, PolicyNode } from '@run-iq/policy-dsl';
import type { RuleInput } from '@run-iq/context-engine';
import type { GenerationOptions, JSONLogicExpression } from '../types.js';
import { SchemaValidationError } from '../errors.js';

export class RuleInputGenerator {
  generate(
    node: PolicyNode,
    compiledCondition: JSONLogicExpression,
    graphMeta: PolicyGraphMeta,
    options: GenerationOptions,
  ): RuleInput {
    const rulePayload: {
      id: string;
      model: string;
      params: unknown;
      condition?: { dsl: string; value: unknown };
    } = {
      id: node.id,
      model: node.model!,
      params: node.params,
    };

    if (node.condition) {
      rulePayload.condition = {
        dsl: 'jsonlogic',
        value: compiledCondition,
      };
    }

    if (!rulePayload.model) {
      throw new SchemaValidationError(`Generated Rule for node "${node.id}" has no model declared`);
    }

    const payload = JSON.stringify(rulePayload);

    return {
      model: node.model!,
      tenantId: options.tenantId,
      scope: 'tenant-specific',
      effectiveFrom: options.effectiveFrom ?? new Date().toISOString().split('T')[0]!,
      effectiveUntil: options.effectiveUntil ?? null,
      priority: node.priority ?? 0,
      tags: [graphMeta.domain, node.sourceRef, 'policy-bridge-generated'],
      description: node.label,
      source: `policy-graph:${graphMeta.id}:${node.id}`,
      payload,
      createdBy: options.actor ?? 'policy-bridge',
      metadata: {
        policyGraphId: graphMeta.id,
        policyGraphVersion: graphMeta.version,
        policyNodeId: node.id,
        sourceRef: node.sourceRef,
        confidence: node.confidence,
        dslVersion: graphMeta.dslVersion,
      },
    };
  }
}
