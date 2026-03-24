import type { PolicyBridgeModelRegistry, PolicyGraph } from '@run-iq/policy-dsl';
import type { RuleInput } from '@run-iq/context-engine';
import { PolicyGraphNavigator, PolicyGraphAnalyzer } from '@run-iq/policy-graph';
import { ExpressionCompiler } from './compiler/ExpressionCompiler.js';
import { ModelValidator } from './validation/ModelValidator.js';
import { RuleRefResolver } from './resolvers/RuleRefResolver.js';
import { ConflictResolver } from './resolvers/ConflictResolver.js';
import { RuleInputGenerator } from './generators/RuleInputGenerator.js';
import { DGGraphGenerator } from './generators/DGGraphGenerator.js';
import { CompilationError, UnsupportedOperatorError } from './errors.js';
import type {
  BridgeOptions,
  CompileOptions,
  CompilationResult,
  CompilationWarning,
} from './types.js';

export class PolicyBridge {
  private readonly expressionCompiler: ExpressionCompiler;
  private readonly modelValidator: ModelValidator;
  private readonly ruleRefResolver: RuleRefResolver;
  private readonly conflictResolver: ConflictResolver;
  private readonly ruleInputGenerator: RuleInputGenerator;
  private readonly dgGraphGenerator: DGGraphGenerator;

  constructor(
    private readonly modelRegistry: PolicyBridgeModelRegistry,
    private readonly options: BridgeOptions = {},
  ) {
    this.expressionCompiler = new ExpressionCompiler();
    this.modelValidator = new ModelValidator(modelRegistry);
    this.ruleRefResolver = new RuleRefResolver();
    this.conflictResolver = new ConflictResolver();
    this.ruleInputGenerator = new RuleInputGenerator();
    this.dgGraphGenerator = new DGGraphGenerator();
  }

  compile(graph: PolicyGraph, options: CompileOptions): CompilationResult {
    // 0. Mode check
    if (graph.meta.mode !== 'integrated') {
      throw new CompilationError(`PolicyBridge requires Mode 2 graph. Got: "${graph.meta.mode}"`);
    }

    // 1. Health check
    const health = new PolicyGraphAnalyzer(graph).healthScore();
    if (!health.readyForBridge && !this.options.forceCompile) {
      throw new CompilationError(
        `PolicyGraph not ready for bridge. ` +
          `Score: ${health.score.toFixed(2)}, ` +
          `Critical conflicts: ${health.criticalConflicts}, ` +
          `Nodes without model: ${health.noModelNodes}`,
      );
    }

    const navigator = new PolicyGraphNavigator(graph);
    const allRuleNodes = navigator.getRuleNodes();

    // Filter by confidence
    let ruleNodes = allRuleNodes;
    if (!options.includeAllConfidences) {
      ruleNodes = allRuleNodes.filter((n) => n.confidence >= (options.confidenceThreshold ?? 0.8));
    }

    // 2. Conflict resolution
    const { activeNodes, suppressedNodes } = this.conflictResolver.resolve(ruleNodes, graph.edges);

    // 3. RULE_REF resolution
    const resolvedNodes = this.ruleRefResolver.resolve(activeNodes);

    // 4. Per-node compilation
    const rules: RuleInput[] = [];
    const errors: CompilationError[] = [];
    const warnings: CompilationWarning[] = [];

    for (const node of resolvedNodes) {
      try {
        // 4a. Model validation
        const modelResult = this.modelValidator.validate(node);
        if (!modelResult.valid) {
          if (this.options.continueOnError) {
            warnings.push({
              nodeId: node.id,
              message: modelResult.message!,
              code: modelResult.reason!,
            });
            continue;
          }
          throw new CompilationError(modelResult.message!);
        }
        if (modelResult.warning) {
          warnings.push({ nodeId: node.id, message: modelResult.warning, code: 'MODEL_WARNING' });
        }

        // 4b. Expression compilation
        if (!node.condition) {
          throw new CompilationError(`Node "${node.id}" has no condition`);
        }
        const compiledCondition = this.expressionCompiler.compile(node.condition);

        // 4c. RuleInput generation
        const ruleInput = this.ruleInputGenerator.generate(
          node,
          compiledCondition,
          graph.meta,
          options,
        );
        rules.push(ruleInput);
      } catch (err) {
        if (err instanceof UnsupportedOperatorError) {
          warnings.push({
            nodeId: node.id,
            message: (err as Error).message,
            code: 'UNSUPPORTED_OPERATOR',
          });
        } else {
          errors.push(err as CompilationError);
          if (!this.options.continueOnError) throw err;
        }
      }
    }

    // 5. DGGraph — generated with effectively compiled nodes only
    const compiledNodes = resolvedNodes.filter((n) => rules.some((r) => r.source?.includes(n.id)));
    const dgGraph = this.dgGraphGenerator.generate(graph, compiledNodes, graph.meta, options);

    // Identify skipped nodes (from all rule nodes, not just confidence-filtered)
    const compiledNodeIds = new Set(compiledNodes.map((n) => n.id));
    const suppressedNodeIds = new Set(suppressedNodes.map((n) => n.id));
    const skippedNodes = allRuleNodes
      .filter((n) => !compiledNodeIds.has(n.id) && !suppressedNodeIds.has(n.id))
      .map((n) => n.id);

    return {
      rules,
      dgGraph,
      report: {
        graphId: graph.meta.id,
        mode: graph.meta.mode,
        totalRuleNodes: allRuleNodes.length,
        compiled: rules.length,
        suppressed: suppressedNodes.length,
        skipped: skippedNodes.length,
        skippedNodes,
        errors: errors.length,
        warnings: warnings.length,
        errorDetails: errors,
        warningDetails: warnings,
        suppressedNodes: suppressedNodes.map((n) => n.id),
        readyForRegistry: errors.length === 0,
      },
    };
  }
}
