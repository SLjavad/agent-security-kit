# Performance and security

Applies to any stack. Items marked (general practice) are not from a fetched source.

## Keep the two questions apart
- **Bottleneck:** a legitimate workload is slower than it should be. That is a performance question. Use profiling and measurement, not a security review. Use your platform's profiler, runtime counters or traces, and a benchmark harness. (general practice)
- **Resource exhaustion:** someone makes the service slow or unavailable, deliberately or by accident. That is a security question: availability.

A slow endpoint is a security issue when an outsider can trigger it cheaply and repeatedly.

## Where performance defects become denial of service (general practice)
1. **Unbounded queries.** List endpoints without pagination, filters that scan whole tables, loading entire result sets into memory, exports that read everything. Require a maximum page size and indexes for filter columns.
2. **N+1 queries and fan-out.** One request causing hundreds of database or partner calls amplifies a small attack.
3. **Expensive operations behind cheap requests.** Password hashing, report generation, image processing, regular expressions, document rendering. Put stricter rate limits and concurrency limits on these; choose a limiter by endpoint cost.
4. **Blocked worker threads.** Synchronous I/O or waiting on asynchronous work from a synchronous context exhausts a thread pool under load and makes the service unresponsive. Many servers disable synchronous I/O by default for this reason.
5. **Regular-expression backtracking.** See `abuse-and-integrations.md`; use timeouts or non-backtracking modes.
6. **Large bodies and slow clients.** Body size limits, timeouts, and minimum data rates.
7. **Cache stampede and cache poisoning.** Many requests for an expired key hit the database together; user-controlled cache keys fill memory. Bound cache size and include user or tenant in keys where content differs.
8. **Unbounded queues and parallelism.** Producers can outrun consumers. Bound both.
9. **Missing timeouts.** Outbound calls, database commands, and locks need timeouts and cancellation. A slow partner should not exhaust your workers.
10. **Amplification.** Endpoints whose response is far larger than the request, or that send email, SMS, or webhooks per request, can harm others or run up your costs. Limit per user and per destination.
11. **Cost as an attack surface.** Pay-per-use services (messaging, AI, serverless functions) need quotas so abuse cannot become a bill.

## Review questions
- What is the most expensive request a stranger can send, and how many per second can they send it?
- What stops a list or export from returning the whole table?
- What happens to the rest of the system when one dependency stops responding for a minute?

## Output
Report each item with the trigger request, the resource consumed, the current limit (or its absence), and the smallest control that bounds it. Do not report general slowness as a vulnerability.

*Stack-specific notes: `stacks/<stack>/performance-vs-security.md` for the detected stack, when present.*
