# Stack template

Copy this folder to `stacks/<id>/`, then:

1. Edit `stack.json`: set `id` to the folder name, `name`, file patterns in `detect`, sources, the verification month, and the list of topic documents you write.
2. For each topic in `docs`, create `<topic>.md` with the same file name as the matching document in `core/`. Start with a line naming the core document, the versions covered, and the check date. Add only stack-specific material, cite sources, and label unsourced statements as general practice.
3. Optionally add `hook-rules.json` and `templates/`.
4. Run `node --test` from the kit root.

Good topics to start with, in this order: `dependency-supply-chain`, `injection-deserialization-memory`, `authz-and-tenant-isolation`, `crypto-and-data-protection`, `ci-cd-and-secrets`.
