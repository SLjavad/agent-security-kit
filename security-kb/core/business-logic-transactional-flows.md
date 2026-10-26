# Business logic in transactional flows

A checklist for any multi-step workflow that creates or changes value: orders, bookings, payments, credits, refunds, entitlements. It is a design-review aid, not a scanner. Nothing here comes from a single vendor document; it is general practice and needs your domain review before you rely on it. Put project-specific rules in `.claude/security-context.md`, not here.

## Why it matters
Business-logic abuse works with valid requests in an unexpected order, count, or timing. The code can be free of injection and still let someone pay once and receive twice.

## Model the flow first
Write the states and allowed transitions (for example quoted, held, confirmed, paid, cancelled, refunded). Mark each transition with who may trigger it and what must already be true. Every review question below is easier once this exists.

## Checklist
1. **State machine enforced on the server.** Each transition checks the current state. Confirming a cancelled or never-held item must fail. Skipping a step must fail.
2. **Idempotency.** Operations that create value accept an idempotency key or are naturally idempotent. A repeated or retried request returns the first result and creates nothing new.
3. **Replay.** A captured request or callback cannot be replayed later to repeat its effect. Callbacks carry a unique id that is recorded and rejected the second time.
4. **Concurrency.** Two simultaneous requests for the last unit, the same coupon, or the same balance cannot both succeed. Look for read-then-write without a lock, unique constraint, or optimistic concurrency token (a row version).
5. **Price and quantity integrity.** The server recomputes totals from authoritative data. It does not trust a price, discount, currency, or total sent by the client. Check rounding, negative quantities, zero amounts, and currency mismatches.
6. **Authorization on the object.** The caller owns or may act on this order or booking. See `authz-and-tenant-isolation.md`.
7. **Third-party callbacks and status updates.** Verify the sender (signature or authenticated channel), validate the payload against your own record, and do not move a state forward just because a message says so. Check what happens with late, duplicate, or out-of-order messages.
8. **Partial failure.** If step three of five fails after money moved, what restores consistency? Look for compensating actions, outbox patterns, and reconciliation jobs. A silent catch-and-continue is a finding.
9. **Test and simulation modes.** Anything that fakes payment, skips a supplier, or relaxes validation must be impossible to enable in production. Check configuration defaults, feature flags, environment checks, and startup guards, and that the guard fails closed.
10. **Limits and abuse.** Per-account and per-item limits on holds, retries, refunds, promo use, and failed attempts. A hold that never expires can be used to block inventory.
11. **Audit trail.** Every state change records who, when, from where, old and new state. Records cannot be edited by the same actor they describe.
12. **Reconciliation.** There is a periodic comparison between your records and the counterparty's, and a defined owner for the differences.

## Questions to ask the owner
- What is the worst thing a malicious but fully authenticated customer could do with this flow?
- What happens if the same confirm request arrives twice, one second apart?
- What happens if the supplier confirms after you cancelled?
- Who can switch the system into test mode, and how would you know?

## Output
Report findings with the state, transition, and request sequence that triggers them. Mark anything depending on an external system's behaviour as needs-validation.

Further reading: OWASP business logic abuse material and API Security Top 10 (https://owasp.org/www-project-api-security/), not fetched in this build.

*Stack-specific notes: `stacks/<stack>/business-logic-transactional-flows.md` for the detected stack, when present.*
