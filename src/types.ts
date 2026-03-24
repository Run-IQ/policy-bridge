import type { RuleInput } from '@run-iq/context-engine';
import type { DGGraph } from '@run-iq/dg';
import type { CompilationError } from './errors.js';

// JSONLogic compiled output
export type JSONLogicExpression =
  | { and: JSONLogicExpression[] }
  | { or: JSONLogicExpression[] }
  | { '!': [JSONLogicExpression] }
  | { '!!': [JSONLogicExpression] }
  | { '>': [unknown, unknown] }
  | { '>=': [unknown, unknown] }
  | { '<': [unknown, unknown] }
  | { '<=': [unknown, unknown] }
  | { '==': [unknown, unknown] }
  | { '!=': [unknown, unknown] }
  | { in: [unknown, unknown[]] }
  | { date_before: [unknown, unknown] }
  | { date_after: [unknown, unknown] }
  | { var: string }
  | unknown;

// Model validation
export interface ModelValidationResult {
  valid: boolean;
  reason?: 'NO_MODEL_DECLARED' | 'MODEL_NOT_IN_REGISTRY' | 'INVALID_PARAMS';
  message?: string;
  errors?: string[];
  warning?: string;
  needsHumanReview?: boolean;
}

// Conflict resolution
export interface ConflictResolutionResult {
  activeNodes: import('@run-iq/policy-dsl').PolicyNode[];
  suppressedNodes: import('@run-iq/policy-dsl').PolicyNode[];
}

// Generation options
export interface GenerationOptions {
  tenantId: string;
  actor?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

// Bridge options
export interface BridgeOptions {
  forceCompile?: boolean;
  continueOnError?: boolean;
}

// Compile options extends GenerationOptions
export interface CompileOptions extends GenerationOptions {
  confidenceThreshold?: number;
  includeAllConfidences?: boolean;
}

// Compilation result
export interface CompilationResult {
  rules: RuleInput[];
  dgGraph: DGGraph;
  report: CompilationReport;
}

// Compilation report
export interface CompilationReport {
  graphId: string;
  mode: string;
  totalRuleNodes: number;
  compiled: number;
  suppressed: number;
  skipped: number;
  skippedNodes: string[];
  errors: number;
  warnings: number;
  errorDetails: CompilationError[];
  warningDetails: CompilationWarning[];
  suppressedNodes: string[];
  readyForRegistry: boolean;
}

// Compilation warning
export interface CompilationWarning {
  nodeId: string;
  message: string;
  code: string;
}

// Preflight report
export interface PreflightReport {
  graphId: string;
  passedPreflight: boolean;
  fatal: number;
  warnings: number;
  issues: PreflightIssue[];
  summary: string;
}

// Preflight issue
export interface PreflightIssue {
  severity: 'fatal' | 'warning';
  nodeId?: string;
  code: string;
  message: string;
  fix: string;
}

// Preflight options
export interface PreflightOptions {
  confidenceThreshold?: number;
}
