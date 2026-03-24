// Orchestrator
export { PolicyBridge } from './PolicyBridge.js';

// PreflightChecker
export { PreflightChecker } from './PreflightChecker.js';

// Compiler
export { ExpressionCompiler } from './compiler/ExpressionCompiler.js';

// Validation
export { ModelValidator } from './validation/ModelValidator.js';

// Resolvers
export { RuleRefResolver } from './resolvers/RuleRefResolver.js';
export { ConflictResolver } from './resolvers/ConflictResolver.js';

// Generators
export { RuleInputGenerator } from './generators/RuleInputGenerator.js';
export { DGGraphGenerator } from './generators/DGGraphGenerator.js';

// Errors
export {
  CompilationError,
  UnsupportedOperatorError,
  CycleError,
  UnresolvableReferenceError,
  SchemaValidationError,
  StandaloneModeError,
} from './errors.js';

// Types
export type {
  JSONLogicExpression,
  ModelValidationResult,
  ConflictResolutionResult,
  GenerationOptions,
  BridgeOptions,
  CompileOptions,
  CompilationResult,
  CompilationReport,
  CompilationWarning,
  PreflightReport,
  PreflightIssue,
  PreflightOptions,
} from './types.js';
