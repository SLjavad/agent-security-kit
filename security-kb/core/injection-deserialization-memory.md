# Injection, deserialization, and memory

Applies to any language. API names, analyzer rules, and framework specifics are in the stack document. Items marked (general practice) are not from a fetched source.

## SQL and query injection
- Pass untrusted values as bound parameters, never by concatenating or interpolating them into query text. Check whether your data layer's "raw" or "string" query functions accept values safely or only accept finished text.
- Identifiers (column and table names, sort fields) cannot be parameters. Map them from a fixed allow-list; never pass client text.
- Dynamic search and sort features are the common source of string-built queries. Review them first.
- Stored procedures are not automatically safe if they build query strings inside.
- The same rule applies to NoSQL queries, LDAP filters, and expression languages: use the library's parameterisation or escaping API.

## Other injection
- **Command injection:** never pass user text to a shell or build one command string from it. Use argument lists, allow-list the executable, avoid shells. (general practice)
- **Path traversal:** combine a trusted base path and a user file name, resolve to an absolute path, and verify the result is inside the base directory. Reject rooted names and parent-directory segments. (general practice)
- **XML:** disable DTD processing and external entity resolution for untrusted XML, and bound input size. (general practice)
- **Cross-site scripting:** use the template engine's default output encoding and search for the "raw" or "unescaped" escape hatches and for HTML built from strings. (general practice)
- **Header and log injection:** reject or encode CR and LF in values placed in headers or log lines. (general practice)
- **Template injection:** do not compile templates from user input. (general practice)
- **Regular-expression injection and ReDoS:** see `abuse-and-integrations.md`.
- **Server-side request forgery:** see `abuse-and-integrations.md`.

## Deserialization
- Any deserializer that lets the input choose which types or objects to create is dangerous (weakness class CWE-502). Typical offenders are native object serialization formats and generic polymorphic JSON or YAML loaders.
- Deserialize into plain data types you define, with a schema or allow-list. Do not enable type-name or class-name handling for untrusted input. Prefer data formats with no behaviour.
- Bound input size and nesting depth.
- Treat any dependency on a legacy unsafe serializer, or a compatibility package that restores one, as a finding.

## Memory safety
- Memory-safe languages and managed runtimes bounds-check ordinary code, so classic buffer overflows do not occur there. Memory-corruption risk comes from the exceptions: explicitly unsafe code blocks, raw pointer and stack-allocation features, foreign-function and native-interop calls, and native libraries loaded by the process. Search for those keywords. If none exist and no native code is loaded, binary-level review has little to find.
- For languages without memory safety (C, C++, parts of other stacks), memory errors are the main class of serious bugs: bounds, integer overflow, use-after-free, uninitialised memory, races. That is tier 3 work: sanitizers, fuzzing, and specialist review.
- Interop: check buffer sizes passed to native code, structure layouts, string marshalling, lifetime of pinned memory, and who frees what.
- Native dependencies need the same patching as the runtime. List them.

## Leaks and exhaustion (reliability that becomes availability)
- Resources that are not released (connections, file handles, streams, clients created per call), listeners never removed, unbounded caches, and growing collections cause outages. Review release patterns, client reuse, and cache bounds on hot paths; watch memory and handle metrics. (general practice)
- Secrets in memory: strings are usually immutable and cannot be wiped on demand. Reduce the time and places secrets are held, never log them, and limit crash dumps on sensitive hosts. Prefer holding credentials in a store outside the process. (general practice)

## Checklist
- [ ] No query text built from untrusted values; identifiers come from allow-lists
- [ ] No unsafe object deserialization of untrusted data; no type-name handling on untrusted input
- [ ] Process, file, and path APIs never receive unvalidated user text
- [ ] Unsafe code, native interop, and native libraries inventoried and justified
- [ ] Resource release, client reuse, and cache bounds reviewed on hot paths

*Stack-specific notes: `stacks/<stack>/injection-deserialization-memory.md` for the detected stack, when present.*
