/**
 * Feedback signals close the SONA loop. Archetypes that wire SONA expose
 * `recordFeedback(queryId, signal)`. Archetypes that don't (e.g. LocalLLM
 * without a routing layer) accept the call as a no-op and report the
 * capability as dormant in the next {@link ValueReport}.
 */

export type QueryId = string & { readonly __brand: 'QueryId' };

export interface FeedbackSignal {
  /** -1 to 1 normalized. -1 = wrong, 0 = neutral, 1 = correct. */
  readonly score: number;
  /** Optional human-written note attached to the feedback. */
  readonly comment?: string;
  /** Optional categorical label. */
  readonly label?: 'correct' | 'incorrect' | 'partial' | 'hallucination' | 'irrelevant';
  /** Optional client-supplied wall-clock timestamp; defaults to now. */
  readonly timestampMs?: number;
}

export interface FeedbackProvider {
  recordFeedback(queryId: QueryId, signal: FeedbackSignal): Promise<void>;
}
