// Pluggable transport for archetypes. Three concrete kinds:
//   - native: in-process NAPI (Node.js)  — wraps @ruvector/core / @ruvector/ruvllm etc.
//   - wasm:   in-process WASM            — wraps the upstream WASM bundles
//   - http:   remote ruvector-server     — wraps the HTTP/gRPC API
//
// Selection: `'auto'` probes the runtime (Node → native, browser → wasm, explicit
// endpoint → http). Users override via the explicit object form.

export type BackendKind = 'native' | 'wasm' | 'http';

export interface NativeBackendOptions {
  readonly kind: 'native';
  /** Optional explicit path to the .node binary. Auto-detected if omitted. */
  readonly binding?: string;
}

export interface WasmBackendOptions {
  readonly kind: 'wasm';
  /** Worker model. `inline` runs in the host event loop; `dedicated` spawns a Worker. */
  readonly worker?: 'inline' | 'dedicated' | 'sharedworker';
  /** Optional explicit URL/path to the .wasm bundle. */
  readonly wasmUrl?: string;
}

export interface HttpBackendOptions {
  readonly kind: 'http';
  readonly endpoint: string;
  readonly apiKey?: string;
  /** Optional fetch implementation override (e.g. for mocking or fetching through a proxy). */
  readonly fetch?: typeof globalThis.fetch;
  /** Optional default headers added to every request. */
  readonly headers?: Readonly<Record<string, string>>;
}

export interface AutoBackendOptions {
  readonly kind: 'auto';
}

export type BackendOptions =
  | NativeBackendOptions
  | WasmBackendOptions
  | HttpBackendOptions
  | AutoBackendOptions;

/**
 * Convenience: a string shorthand for backend selection.
 * `'auto'` is the default — see {@link BackendOptions} for full control.
 */
export type BackendSpec = BackendKind | 'auto' | BackendOptions;

/**
 * Internal — the resolved, instantiated backend held by an archetype.
 * Consumers don't construct this directly; archetypes resolve it from `BackendSpec`.
 */
export interface Backend {
  readonly kind: BackendKind;
  /** Set of upstream capability names this backend reports as available. */
  readonly capabilities: ReadonlySet<string>;
  close(): Promise<void>;
}
