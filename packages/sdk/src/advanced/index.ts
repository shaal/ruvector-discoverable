/**
 * `@ruvector/sdk/advanced` — escape hatches.
 *
 * Everything reachable from this entry point is *deliberately* one extra import
 * away from the headline surface. Per PRD §5.6 and the M4 ratification: the
 * default path is the unique-RuVector path. To get a generic vector DB or to
 * touch upstream-but-not-archetyped capabilities (FPGA, kernel, postgres,
 * quantum), the developer reaches into `/advanced` explicitly.
 *
 * v0.1 surface is intentionally small. Capabilities are *named* but not
 * exposed as classes — most of them are research-stage upstream and the SDK
 * doesn't lock their API yet.
 */

import { NotImplementedError } from '../core/index.js';

/**
 * The "low-level" generic vector DB path. NO archetype defaults applied.
 * Equivalent to constructing the upstream `VectorDB` directly.
 *
 * Use this only when you specifically don't want the unique-RuVector path.
 * If you find yourself reaching for it because it "looks simpler," that's a
 * signal to pick an archetype instead.
 */
export class LowLevel {
  static async create(_options: { dimensions: number; storage?: string }): Promise<LowLevel> {
    throw new NotImplementedError('LowLevel.create');
  }
  insert(_id: string, _vector: Float32Array): Promise<void> {
    throw new NotImplementedError('LowLevel.insert');
  }
  search(_vector: Float32Array, _k: number): Promise<readonly { id: string; score: number }[]> {
    throw new NotImplementedError('LowLevel.search');
  }
  close(): Promise<void> {
    throw new NotImplementedError('LowLevel.close');
  }
}

/**
 * Static capability registry derived from the M3 catalog.
 * v0.1 returns a stub; v0.2 will populate from the catalog at build time.
 */
export const capabilities = {
  list(_filter?: { category?: string }): readonly CapabilityRecord[] {
    throw new NotImplementedError('capabilities.list');
  },
  recommend(_workload: { workload: string }): readonly CapabilityRecord[] {
    throw new NotImplementedError('capabilities.recommend');
  },
};

export interface CapabilityRecord {
  readonly name: string;
  readonly source: string;
  readonly category: 'attention' | 'graph' | 'retrieval' | 'compression' | 'learning' | 'verification' | 'misc';
  readonly stable: boolean;
  /** True if not commonly available in other vector DBs / SDKs. */
  readonly unique: boolean;
  readonly adrs?: readonly string[];
  readonly description: string;
}

/**
 * Out-of-headline namespaces — placeholders for upstream surfaces deliberately
 * kept off the autocomplete-by-default path. Each is a separate type so a
 * future v0.2 can attach methods without breaking the import shape.
 */
export const FPGA = { __namespace: 'FPGA' as const };
export const Quantum = { __namespace: 'Quantum' as const };
export const Postgres = { __namespace: 'Postgres' as const };
export const Kernel = { __namespace: 'Kernel' as const };
