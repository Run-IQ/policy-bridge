# @run-iq/policy-bridge

Compiles a `PolicyGraph` into what the Run-IQ runtime executes: rules with JSONLogic conditions, and a decision graph that runs them. No LLM is involved; the same graph and options always give the same output.

A `PolicyGraph` ([`policy-dsl`](https://github.com/Run-IQ/policy-dsl)) is usually extracted from a document by [`policy-engine`](https://github.com/Run-IQ/policy-engine), then reviewed with [`policy-graph`](https://github.com/Run-IQ/policy-graph). This package is the last step. Its output goes to a rule store ([`context-engine`](https://github.com/Run-IQ/context-engine), [`rule-registry`](https://github.com/Run-IQ/rule-registry)), where rules are evaluated by [`core`](https://github.com/Run-IQ/core) and orchestrated by [`decision-graph`](https://github.com/Run-IQ/decision-graph).

## Install

Version 0.1.0 is on the npm registry, but its peer dependencies (`@run-iq/policy-dsl`, `@run-iq/policy-graph`, `@run-iq/context-engine`, `@run-iq/dg`) are not, so `npm install @run-iq/policy-bridge` fails for now.

To build from source, clone this repo next to `policy-dsl`, `policy-graph`, `context-engine` and `decision-graph` (the dev dependencies point to `../<repo>`), build those first, then run `npm install && npm run build` here. Requires Node.js 20 or later.

## Example

```ts
import { PolicyBridge, PreflightChecker } from '@run-iq/policy-bridge';
import type { PolicyGraph, PolicyBridgeModel } from '@run-iq/policy-dsl';

// An integrated-mode graph: each rule node names a calculation model and its params.
const graph: PolicyGraph = {
  meta: {
    id: 'delivery-policy',
    version: '1',
    dslVersion: '1.0.0',
    title: 'Delivery policy',
    domain: 'logistics',
    language: 'en',
    mode: 'integrated',
    source: { filename: 'delivery-policy.txt', type: 'text', hash: '', ingestedAt: '2025-01-01' },
    confidence: 0.92,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  nodes: [
    {
      id: 'late_refund',
      type: 'Rule',
      label: 'Refund 10% when delivery is more than 3 days late',
      condition: { type: 'GT', left: { type: 'VAR', path: 'delay_days' }, right: { type: 'CONST', value: 3 } },
      action: { type: 'COMPUTE', output: 'refund', value: { type: 'VAR', path: 'order_total' } },
      model: 'PERCENTAGE',
      params: { base: 'order_total', rate: 0.1 },
      sourceRef: 'segment_0',
      confidence: 0.92,
      extractedBy: 'manual',
    },
  ],
  edges: [],
  variables: [],
  chunks: [],
  index: {
    byType: { Rule: ['late_refund'], Exception: [], Definition: [], Reference: [], Threshold: [] },
    bySource: { segment_0: ['late_refund'] },
    conflicts: [],
    gaps: [],
  },
};

// The models your plugins provide, seen through their params validator.
const percentage: PolicyBridgeModel = {
  name: 'PERCENTAGE',
  validateParams: (p) => ({ valid: typeof (p as { rate?: unknown })?.rate === 'number' }),
};
const models = new Map([[percentage.name, percentage]]);
const registry = { get: (name: string) => models.get(name) ?? null, getAll: () => models };

new PreflightChecker(registry).check(graph).passedPreflight; // true

const bridge = new PolicyBridge(registry);
const { rules, dgGraph, report } = bridge.compile(graph, { tenantId: 'acme', effectiveFrom: '2025-01-01' });

JSON.parse(rules[0].payload);
// { id: 'late_refund', model: 'PERCENTAGE', params: { base: 'order_total', rate: 0.1 },
//   condition: { dsl: 'jsonlogic', value: { '>': [{ var: 'delay_days' }, 3] } } }
Object.keys(dgGraph.nodes); // ['late_refund']
report.readyForRegistry;    // true
```

## Output

- **`rules`**: `RuleInput[]`, the input format of the `context-engine` `RuleStore`. Each `payload` is a JSON string holding the rule's id, model, params and JSONLogic condition. `metadata` links it back to the graph node and its `sourceRef`.
- **`dgGraph`**: a `DGGraph` with one compute node per rule, a `merge_result` node when there is more than one rule, and an edge for each `REQUIRES` relation.
- **`report`**: how many rule nodes were compiled, suppressed or skipped, and why.

## How `compile()` works

1. Reject graphs that are not in integrated mode
2. Reject graphs that `policy-graph` does not consider ready (`forceCompile` skips this)
3. Skip rule nodes below the confidence threshold
4. Drop nodes that another node `OVERRIDES`
5. Replace each `RULE_REF` with the referenced rule's condition, failing on cycles
6. Check each node's model and params against the registry
7. Compile conditions to JSONLogic and generate the rules and the decision graph

`PreflightChecker` looks for the problems that would stop compilation (wrong mode, missing or unknown models, invalid params, broken or circular `RULE_REF`, critical conflicts, low confidence) and returns all of them, each with a suggested fix, instead of throwing at the first one.

## Options

| Option | Default | |
|---|---|---|
| `tenantId` | required | Tenant the generated rules belong to |
| `effectiveFrom` | today | Start of validity of the generated rules |
| `effectiveUntil` | `null` | End of validity |
| `actor` | `'policy-bridge'` | Written to `createdBy` |
| `confidenceThreshold` | `0.8` | Rule nodes below it are skipped |
| `includeAllConfidences` | `false` | Compile every rule node regardless of confidence |

The constructor also takes `{ forceCompile, continueOnError }`. With `continueOnError`, a node that fails is reported and compilation goes on.

## Limitations

`BEFORE` and `AFTER` compile to `date_before` and `date_after`, which are not standard JSONLogic operators and are not registered by `@run-iq/dsl-jsonlogic` yet. Rules using them will not evaluate there.

## License

Business Source License 1.1. Production use is allowed, except offering the package as a hosted or embedded service that competes with the licensor. It converts to Apache 2.0 on 2030-01-01. See [LICENSE](LICENSE).
