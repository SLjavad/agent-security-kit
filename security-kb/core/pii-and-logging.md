# Personal data and logging

Applies to any stack. Items marked (general practice) are not from a fetched source.

## Principle
Logs, traces, error pages, and metrics are data stores that are usually less protected than the database. Personal data, credentials, and tokens must not enter them in readable form.

## Checklist
1. Inventory the personal and sensitive data the system holds (names, contact details, identity documents, payment references, tokens). Mark where each field appears in logs, traces, analytics, and error reports. (general practice)
2. Redact or classify sensitive fields in the logging layer, so developers cannot forget. Prefer a redaction facility of the logging stack over per-call discipline.
3. Search for logging of whole objects (serialised requests, entities, `toString` of records with personal fields). Do not log them whole.
4. Search for secrets in logs: bearer tokens, API keys, connection strings, password-reset links, session identifiers.
5. User-controlled text in log messages can forge lines or break parsers. Use structured logging with parameters, not string concatenation.
6. Production log level is not debug or trace unless there is a time-boxed reason.
7. Debug and developer error pages are disabled in production. Error responses to clients are generic: a message and a correlation id, never a stack trace, query, or configuration value.
8. Do not log full request bodies, authorization headers, or cookies by default.
9. Logs are access-controlled, retained for a defined period, and deleted on schedule. Retention follows the shortest legitimate need.
10. Analytics, error trackers, and performance-monitoring tools are third parties. Check what they receive and under what contract. Do not send personal data to them without a decision.
11. Backups and exports contain the same data as the live system and need the same protection and expiry.
12. A person's request to see or delete their data can be fulfilled across databases, logs where required, caches, search indexes, and backups, or the limits are documented.
13. Test and development environments do not hold production personal data, or the data is masked.

## Audit logs are different
Security-relevant events (sign-in failures, permission changes, state changes in money flows) must be logged with who, what, when, and from where, and protected from alteration by the people they describe. Log the identifiers needed to investigate, not the sensitive payload.

## Output
When reporting, name the field, the sink (log, response, trace), and the reader who could see it. Rate by who can read the sink, not by how sensitive the field sounds.

*Stack-specific notes: `stacks/<stack>/pii-and-logging.md` for the detected stack, when present.*
