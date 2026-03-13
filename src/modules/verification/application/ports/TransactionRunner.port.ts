/**
 * Application-layer port for running a block of logic inside a DB transaction.
 * The `tx` argument passed to `fn` is an opaque transaction handle — the domain
 * port (`EmailVerificationRepository`) accepts it as `unknown` and the Postgres
 * implementation casts it to `PoolClient`.
 *
 * This keeps infrastructure types (Pool, PoolClient) out of the application layer.
 */
export interface TransactionRunner {
  run<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
}
