export class CompilationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompilationError';
  }
}

export class UnsupportedOperatorError extends CompilationError {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedOperatorError';
  }
}

export class CycleError extends CompilationError {
  constructor(message: string) {
    super(message);
    this.name = 'CycleError';
  }
}

export class UnresolvableReferenceError extends CompilationError {
  constructor(message: string) {
    super(message);
    this.name = 'UnresolvableReferenceError';
  }
}

export class SchemaValidationError extends CompilationError {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

export class StandaloneModeError extends CompilationError {
  constructor(message: string) {
    super(message);
    this.name = 'StandaloneModeError';
  }
}
