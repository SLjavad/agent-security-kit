# Security knowledge index

Open only the document that matches the task. Paths are relative to `~/.claude/security-kb/`. For each topic read the core document, then the stack document of every detected stack at `stacks/<id>/<same file name>` if it exists (see `stacks/README.md`).

| Topic | Core document |
|---|---|
| Who may do what, cross-tenant access, object-level authorization, service-to-service auth | `core/authz-and-tenant-isolation.md` |
| Orders, bookings, payments, credits: replay, races, price integrity, state machines, callbacks | `core/business-logic-transactional-flows.md` |
| Package dependencies, private registries, dependency confusion, vulnerable packages, lock files, SBOM | `core/dependency-supply-chain.md` |
| Pipelines, runners, CI variables, registry access, traceability, secret rotation | `core/ci-cd-and-secrets.md` |
| Runtime and framework updates, end of support, base images, CVE triage | `core/patching-cadence.md` |
| Logging, redaction, error detail, retention, personal data | `core/pii-and-logging.md` |
| Rate limits, request limits, regex timeouts, webhooks, SSRF, egress, upstream trust | `core/abuse-and-integrations.md` |
| Threat modelling and incident response | `core/threat-model-and-ir.md` |
| Prompt injection, MCP servers, skills, hooks, agent safety | `core/ai-tooling-security.md` |
| Compliance scoping questions | `core/compliance-conditional.md` |
| TLS, HSTS, CORS, headers, reverse proxy, server configuration, detection basics | `core/hardening-network-server.md` |
| SQL and other injection, deserialization, native interop, memory and leaks | `core/injection-deserialization-memory.md` |
| Cryptography, key management, password hashing, what to encrypt or hash, obfuscation | `core/crypto-and-data-protection.md` |
| Performance versus security, resource exhaustion | `core/performance-vs-security.md` |
| Which automated checks to run in CI, where, how to install and tune them | `core/ci-security-tooling.md` |
| SBOMs, advisory matching, triage of findings, licence checks | `core/sbom-and-dependency-scanning.md` |
| Images, containers, registries, orchestrator settings | `core/container-hardening.md` |
| Products that embed an LLM, retrieval, or agent with tools | `core/llm-and-agent-security.md` |
| Personal-data inventory, impact assessment, data subject requests, breaches | `core/privacy-assessment-and-dsar.md` |
| Nonce and key pitfalls, key management, post-quantum readiness | `core/crypto-implementation-and-pqc.md` |
| Recent CVEs and advisories for the project's libraries, runtimes, images, and services (`/security-kit advisories`) | `core/advisory-checks.md` |

| Other material | Location |
|---|---|
| Project context, secret scanning configuration, CI secret-scan job, CI advisory-scan job | `templates/` |
| Stack folders, the contract for adding one | `stacks/README.md` |
| Stack templates (configuration snippets for that stack) | `stacks/<id>/templates/` |
