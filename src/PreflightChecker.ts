import type {
  PolicyBridgeModelRegistry,
  PolicyExpression,
  PolicyGraph,
  PolicyNode,
} from '@run-iq/policy-dsl';
import { PolicyGraphNavigator, PolicyGraphAnalyzer } from '@run-iq/policy-graph';
import type { PreflightReport, PreflightIssue, PreflightOptions } from './types.js';

export class PreflightChecker {
  constructor(private readonly modelRegistry: PolicyBridgeModelRegistry) {}

  check(graph: PolicyGraph, options: PreflightOptions = {}): PreflightReport {
    const issues: PreflightIssue[] = [];
    const navigator = new PolicyGraphNavigator(graph);

    // 1. Mode check
    if (graph.meta.mode !== 'integrated') {
      issues.push({
        severity: 'fatal',
        code: 'WRONG_MODE',
        message:
          `Graph produced in "${graph.meta.mode}" mode. Bridge requires Mode 2 (integrated). ` +
          `Re-process the document with a ModelRegistry injected in PolicyEngine.`,
        fix: 'Re-run PolicyEngine with modelRegistry option injected',
      });
      return this.buildReport(issues, graph, navigator, options);
    }

    const ruleNodes = navigator.getRuleNodes();

    // 2. Nodes without model
    const noModel = navigator.getNodesWithoutModel();
    for (const node of noModel) {
      issues.push({
        severity: 'fatal',
        nodeId: node.id,
        code: 'NO_MODEL',
        message:
          `Node "${node.id}" (${node.label}) has no model declared. ` +
          `Confidence: ${node.confidence.toFixed(2)}. Source: ${node.sourceRef}.`,
        fix: 'Validate manually and set model in the UI, or re-process with better LLM prompt',
      });
    }

    // 3. Models not in registry
    for (const node of ruleNodes) {
      if (node.model && node.model !== 'UNKNOWN') {
        const model = this.modelRegistry.get(node.model);
        if (!model) {
          issues.push({
            severity: 'fatal',
            nodeId: node.id,
            code: 'MODEL_NOT_IN_REGISTRY',
            message:
              `Node "${node.id}" declares model "${node.model}" which is not in the registry. ` +
              `Available models: ${[...this.modelRegistry.getAll().keys()].join(', ')}`,
            fix: `Ensure the plugin providing "${node.model}" is loaded before compiling`,
          });
        }
      }
    }

    // 4. Invalid params
    for (const node of ruleNodes) {
      if (node.model && node.model !== 'UNKNOWN' && node.params !== undefined) {
        const model = this.modelRegistry.get(node.model);
        if (model) {
          const validation = model.validateParams(node.params);
          if (!validation.valid) {
            issues.push({
              severity: 'fatal',
              nodeId: node.id,
              code: 'INVALID_PARAMS',
              message:
                `Node "${node.id}" model "${node.model}" params validation failed: ` +
                (validation.errors?.join(', ') ?? 'unknown error'),
              fix: 'Correct the params in the UI before compiling',
            });
          }
        }
      }
    }

    // 5. RULE_REF resolvability
    const nodeMap = new Map(ruleNodes.map((n) => [n.id, n]));
    for (const node of ruleNodes) {
      if (node.condition) {
        const refs = this.extractAllRuleRefs(node.condition);
        for (const refId of refs) {
          if (!nodeMap.has(refId)) {
            issues.push({
              severity: 'fatal',
              nodeId: node.id,
              code: 'UNRESOLVABLE_RULE_REF',
              message: `Node "${node.id}" references "${refId}" via RULE_REF but this node doesn't exist.`,
              fix: 'Remove or fix the RULE_REF in the condition',
            });
          }
        }
      }
    }

    // 6. RULE_REF cycles
    const cycles = this.detectRuleRefCycles(ruleNodes);
    for (const cycle of cycles) {
      issues.push({
        severity: 'fatal',
        code: 'RULE_REF_CYCLE',
        message: `Circular RULE_REF detected: ${cycle.join(' → ')}`,
        fix: 'Break the circular reference — inline the condition manually',
      });
    }

    // 7. Low confidence nodes
    const threshold = options.confidenceThreshold ?? 0.8;
    const flagged = ruleNodes.filter((n) => n.confidence < threshold || n.flagged);
    for (const node of flagged) {
      issues.push({
        severity: 'warning',
        nodeId: node.id,
        code: 'LOW_CONFIDENCE',
        message:
          `Node "${node.id}" confidence ${node.confidence.toFixed(2)} < ${threshold}. ` +
          `This node will be SKIPPED by the bridge unless includeAllConfidences=true.`,
        fix: 'Validate and manually confirm this node, or lower confidenceThreshold',
      });
    }

    // 8. Critical conflicts
    const analyzer = new PolicyGraphAnalyzer(graph);
    const conflicts = analyzer.findConflicts().filter((c) => c.severity === 'critical');
    for (const conflict of conflicts) {
      issues.push({
        severity: 'fatal',
        code: 'CRITICAL_CONFLICT',
        message: `Critical conflict between "${conflict.nodeId1}" and "${conflict.nodeId2}": ${conflict.description}`,
        fix: 'Resolve the conflict manually before compiling',
      });
    }

    // 9. Multi-plugin mismatch warning
    const allModels = [...this.modelRegistry.getAll().keys()];
    const usedModels = [...new Set(ruleNodes.map((n) => n.model).filter(Boolean))];
    if (allModels.length > 3 && usedModels.length > 1) {
      issues.push({
        severity: 'warning',
        code: 'MULTI_PLUGIN_REVIEW',
        message:
          `Multiple models detected in the graph: [${usedModels.join(', ')}]. ` +
          `With multiple plugins loaded, verify that each node's model matches its source text. ` +
          `Miscategorization (fiscal → payroll) won't be caught at compile-time but will fail at runtime.`,
        fix: 'Review nodes with mixed models against their source text via sourceRef',
      });
    }

    return this.buildReport(issues, graph, navigator, options);
  }

  private buildReport(
    issues: PreflightIssue[],
    graph: PolicyGraph,
    _navigator: PolicyGraphNavigator,
    _options: PreflightOptions,
  ): PreflightReport {
    const fatal = issues.filter((i) => i.severity === 'fatal');
    const warnings = issues.filter((i) => i.severity === 'warning');

    return {
      graphId: graph.meta.id,
      passedPreflight: fatal.length === 0,
      fatal: fatal.length,
      warnings: warnings.length,
      issues,
      summary:
        fatal.length === 0
          ? `Graph is ready for compilation. ${warnings.length} warning(s) to review.`
          : `${fatal.length} fatal issue(s) must be resolved before compilation.`,
    };
  }

  private extractAllRuleRefs(expr: PolicyExpression): string[] {
    if (expr.type === 'RULE_REF') return [expr.ruleId];
    if (expr.type === 'AND' || expr.type === 'OR') {
      return [...this.extractAllRuleRefs(expr.left), ...this.extractAllRuleRefs(expr.right)];
    }
    if (expr.type === 'NOT') return this.extractAllRuleRefs(expr.expr);
    return [];
  }

  private detectRuleRefCycles(nodes: PolicyNode[]): string[][] {
    const graph = new Map<string, string[]>();

    for (const node of nodes) {
      if (node.condition) {
        graph.set(node.id, this.extractAllRuleRefs(node.condition));
      }
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      inStack.add(nodeId);
      path.push(nodeId);

      for (const ref of graph.get(nodeId) ?? []) {
        if (!visited.has(ref)) {
          dfs(ref);
        } else if (inStack.has(ref)) {
          const cycleStart = path.indexOf(ref);
          cycles.push([...path.slice(cycleStart), ref]);
        }
      }

      path.pop();
      inStack.delete(nodeId);
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) dfs(node.id);
    }

    return cycles;
  }
}
