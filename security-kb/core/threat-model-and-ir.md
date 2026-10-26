# Threat modelling and incident response

General practice; no fetched sources. Keep both light enough that they are actually done.

## Lightweight threat model (one hour per feature or service)
1. **Draw the data flow.** Boxes for actors, services, and stores; arrows for data; dashed lines where trust changes (internet to service, service to database, your system to a partner).
2. **List assets.** What would hurt if stolen, changed, or unavailable: money movement, personal data, credentials, availability of a core flow.
3. **Walk STRIDE on each crossing of a trust line.**

| Threat | Question | Typical control |
|---|---|---|
| Spoofing | Can someone pretend to be a user or service? | Authentication, mutual TLS, signed callbacks |
| Tampering | Can data change in transit or at rest? | TLS, signatures, integrity checks, authorization |
| Repudiation | Can an actor deny an action? | Audit log with identity and time |
| Information disclosure | Can data leak? | Authorization, encryption, redaction, error handling |
| Denial of service | Can it be made unavailable or expensive? | Rate limits, quotas, timeouts, bounded queues |
| Elevation of privilege | Can a low-privilege actor gain more? | Authorization on every action, least privilege |

4. **Record decisions.** For each threat: mitigate, accept (with owner and date), transfer, or avoid. Write down accepted risks in `.claude/security-context.md`.
5. **Turn mitigations into tests or checks.** A threat model that produces no tests is a document.
6. **Revisit** when a trust boundary, data type, or partner changes.

## Incident response runbook skeleton
Write this before you need it. One page.

**Roles:** incident lead, technical lead, communications owner, scribe. Name backups.
**Contacts:** on-call, management, legal or compliance, hosting provider, key partners.

1. **Detect and declare.** Anyone can declare. Record the time and the first observation.
2. **Triage.** What is affected, how severe (data exposed? money moved? service down?), is it still happening?
3. **Contain.** Stop the bleeding with the smallest reversible action: disable an account or key, block a route, isolate a host, turn off a feature. Do not wipe evidence.
4. **Preserve evidence.** Copy logs, images, and configuration before changing them. Note who touched what.
5. **Eradicate.** Remove the cause: patch, rotate every credential the attacker could have reached, remove persistence.
6. **Recover.** Restore from known-good, monitor closely, return to service in steps.
7. **Notify.** Decide who must be told (customers, partners, regulators, insurers) and by when, with the compliance owner. Obligations differ by jurisdiction and contract; see `compliance-conditional.md`.
8. **Review.** Within a week: timeline, root cause, what worked, what to change. Blameless, with owners and dates for actions.

**Secret-leak shortcut:** rotate first, investigate second, clean history last.

## Vulnerability intake
Publish a security contact and a `security.txt` file on public services, acknowledge reports within days, and keep a private tracker for them. Decide in advance who can authorise an emergency fix.

## Exercises
Run a one-hour tabletop twice a year using a realistic scenario (leaked key, compromised dependency, partner callback abuse). The gaps you find are the value.

*Stack-specific notes: `stacks/<stack>/threat-model-and-ir.md` for the detected stack, when present.*
