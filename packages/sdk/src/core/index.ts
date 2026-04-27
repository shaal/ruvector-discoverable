export * from './backend.js';
export * from './explain.js';
export * from './feedback.js';
export * from './health.js';
export * from './pipeline.js';
export * from './value-report.js';

/**
 * Common error class. Specific subtypes per archetype if needed in v0.2.
 */
export class RuVectorError extends Error {
  // Widen to `string` so subclasses can assign their own literal.
  override readonly name: string = 'RuVectorError';
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Marker thrown by every M5 method body. Lets the surface compile and lets
 * tests confirm that no v0.1 caller can accidentally execute a method —
 * everything throws until M6+ wires the backends.
 */
export class NotImplementedError extends RuVectorError {
  override readonly name: string = 'NotImplementedError';
  constructor(method: string) {
    super('NOT_IMPLEMENTED_M5', `${method} is not implemented in M5 (API freeze only).`);
  }
}
