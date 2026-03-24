import type { PolicyBridgeModelRegistry, PolicyNode } from '@run-iq/policy-dsl';
import type { ModelValidationResult } from '../types.js';

export class ModelValidator {
  constructor(private readonly registry: PolicyBridgeModelRegistry) {}

  validate(node: PolicyNode): ModelValidationResult {
    // 1. model declared?
    if (!node.model || node.model === 'UNKNOWN') {
      return {
        valid: false,
        reason: 'NO_MODEL_DECLARED',
        needsHumanReview: true,
        message:
          `Node "${node.id}" has no model declared. ` +
          `The document was processed in Mode 2 but the LLM ` +
          `could not identify a matching model. Human review required.`,
      };
    }

    // 2. model in registry?
    const model = this.registry.get(node.model);
    if (!model) {
      return {
        valid: false,
        reason: 'MODEL_NOT_IN_REGISTRY',
        message:
          `Model "${node.model}" declared in node "${node.id}" ` +
          `is not registered in the ModelRegistry. ` +
          `Is the corresponding plugin (fiscal, payroll...) loaded?`,
      };
    }

    // 3. params valid?
    if (node.params !== undefined) {
      const validation = model.validateParams(node.params);
      if (!validation.valid) {
        return {
          valid: false,
          reason: 'INVALID_PARAMS',
          message:
            `Invalid params for model "${node.model}" in node "${node.id}": ` +
            (validation.errors?.join(', ') ?? 'validation failed'),
          errors: validation.errors ?? [],
        };
      }
    } else {
      // params absent — warning but not blocking
      return {
        valid: true,
        warning:
          `Node "${node.id}" has model "${node.model}" but no params. ` +
          `This may be intentional for simple models.`,
        needsHumanReview: false,
      };
    }

    return { valid: true };
  }
}
