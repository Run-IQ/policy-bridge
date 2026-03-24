import type {
  PolicyGraph,
  PolicyGraphMeta,
  PolicyNode,
  PolicyEdge,
  PolicyExpression,
  PolicyValue,
  PolicyVariable,
  PolicyBridgeModelRegistry,
  PolicyBridgeModel,
  PolicyGraphIndex,
} from '@run-iq/policy-dsl';

// ── PolicyValue helpers ──

export function VAR(path: string): PolicyValue {
  return { type: 'VAR', path };
}

export function CONST(value: string | number | boolean): PolicyValue {
  return { type: 'CONST', value };
}

// ── PolicyExpression helpers ──

export function AND(left: PolicyExpression, right: PolicyExpression): PolicyExpression {
  return { type: 'AND', left, right };
}

export function OR(left: PolicyExpression, right: PolicyExpression): PolicyExpression {
  return { type: 'OR', left, right };
}

export function NOT(expr: PolicyExpression): PolicyExpression {
  return { type: 'NOT', expr };
}

export function GT(left: PolicyValue, right: PolicyValue): PolicyExpression {
  return { type: 'GT', left, right };
}

export function GTE(left: PolicyValue, right: PolicyValue): PolicyExpression {
  return { type: 'GTE', left, right };
}

export function LT(left: PolicyValue, right: PolicyValue): PolicyExpression {
  return { type: 'LT', left, right };
}

export function LTE(left: PolicyValue, right: PolicyValue): PolicyExpression {
  return { type: 'LTE', left, right };
}

export function EQ(left: PolicyValue, right: PolicyValue): PolicyExpression {
  return { type: 'EQ', left, right };
}

export function NEQ(left: PolicyValue, right: PolicyValue): PolicyExpression {
  return { type: 'NEQ', left, right };
}

export function BETWEEN(value: PolicyValue, min: PolicyValue, max: PolicyValue): PolicyExpression {
  return { type: 'BETWEEN', value, min, max };
}

export function IN(value: PolicyValue, set: PolicyValue[]): PolicyExpression {
  return { type: 'IN', value, set };
}

export function NOT_IN(value: PolicyValue, set: PolicyValue[]): PolicyExpression {
  return { type: 'NOT_IN', value, set };
}

export function BEFORE(value: PolicyValue, date: PolicyValue): PolicyExpression {
  return { type: 'BEFORE', value, date };
}

export function AFTER(value: PolicyValue, date: PolicyValue): PolicyExpression {
  return { type: 'AFTER', value, date };
}

export function EXISTS(variable: string): PolicyExpression {
  return { type: 'EXISTS', variable };
}

export function MISSING(variable: string): PolicyExpression {
  return { type: 'MISSING', variable };
}

export function RULE_REF(ruleId: string): PolicyExpression {
  return { type: 'RULE_REF', ruleId };
}

// ── PolicyNode factory ──

let nodeCounter = 0;

export function createPolicyNode(overrides: Partial<PolicyNode> = {}): PolicyNode {
  nodeCounter++;
  return {
    id: `node_${nodeCounter}`,
    type: 'Rule',
    label: `Test Rule ${nodeCounter}`,
    sourceRef: `page-1:art-${nodeCounter}`,
    confidence: 0.95,
    extractedBy: 'llm-v1',
    ...overrides,
  };
}

// ── PolicyEdge factory ──

let edgeCounter = 0;

export function createPolicyEdge(
  overrides: Partial<PolicyEdge> & { from: string; to: string; type: PolicyEdge['type'] },
): PolicyEdge {
  edgeCounter++;
  return {
    id: `edge_${edgeCounter}`,
    ...overrides,
  };
}

// ── PolicyGraphMeta factory ──

export function createGraphMeta(overrides: Partial<PolicyGraphMeta> = {}): PolicyGraphMeta {
  return {
    id: 'test-graph-001',
    version: '1.0.0',
    dslVersion: '1.0.0',
    title: 'Test Policy Graph',
    domain: 'fiscal',
    language: 'fr',
    mode: 'integrated',
    source: {
      filename: 'test.pdf',
      type: 'pdf',
      hash: 'abc123',
      ingestedAt: '2025-01-01T00:00:00Z',
    },
    confidence: 0.9,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── PolicyGraph factory ──

export function createPolicyGraph(
  overrides: {
    meta?: Partial<PolicyGraphMeta>;
    nodes?: PolicyNode[];
    edges?: PolicyEdge[];
    variables?: PolicyVariable[];
  } = {},
): PolicyGraph {
  const nodes = overrides.nodes ?? [];
  const index: PolicyGraphIndex = {
    byType: {
      Rule: nodes.filter((n) => n.type === 'Rule').map((n) => n.id),
      Exception: nodes.filter((n) => n.type === 'Exception').map((n) => n.id),
      Definition: nodes.filter((n) => n.type === 'Definition').map((n) => n.id),
      Reference: nodes.filter((n) => n.type === 'Reference').map((n) => n.id),
      Threshold: nodes.filter((n) => n.type === 'Threshold').map((n) => n.id),
    },
    bySource: {},
    conflicts: [],
    gaps: [],
  };

  return {
    meta: createGraphMeta(overrides.meta),
    nodes,
    edges: overrides.edges ?? [],
    variables: overrides.variables ?? [],
    chunks: [],
    index,
  };
}

// ── Mock ModelRegistry ──

export function createMockModel(
  name: string,
  validateResult: { valid: boolean; errors?: string[] } = { valid: true },
): PolicyBridgeModel {
  return {
    name,
    validateParams: () => validateResult,
  };
}

export function createMockRegistry(models: PolicyBridgeModel[] = []): PolicyBridgeModelRegistry {
  const map = new Map<string, PolicyBridgeModel>();
  for (const model of models) {
    map.set(model.name, model);
  }
  return {
    get: (name: string) => map.get(name) ?? null,
    getAll: () => map,
  };
}

// ── Reset counters (call in beforeEach) ──

export function resetCounters(): void {
  nodeCounter = 0;
  edgeCounter = 0;
}
