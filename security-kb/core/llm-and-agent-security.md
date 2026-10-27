# Security of applications that embed an LLM or agent

Own guidance, organised around the OWASP Top 10 for LLM Applications (2026 edition, which reordered and renumbered the 2025 list) and written from OWASP, NIST AI risk material, and vendor documentation; nothing copied. OWASP also publishes a Top 10 for Agentic Applications (2026) for systems that plan, call tools, and keep memory. This is for **products you build** that call a model, retrieve documents, or let a model take actions. Tools you use to write code (skills, hooks, coding agents) are in `core/ai-tooling-security.md`.

## The central rule
A model cannot reliably tell instructions from data. Anything it reads (a user message, a web page, a document, a tool result, a retrieved chunk) can steer it. So: **never rely on the prompt to enforce security.** Enforce authorization, limits, and validation in code outside the model, and assume the model's output is attacker-influenced.

## Risks and controls
| Risk (OWASP 2026) | Controls |
|---|---|
| LLM01 Prompt injection (direct and indirect) | Separate trusted instructions from untrusted content in structure, not only wording. Treat all retrieved and tool-returned text as data. Limit what the model can do (see excessive agency). Add output checks for the specific harm you fear. |
| LLM02 Sensitive information disclosure | Do not put secrets or other users' data in the context. Retrieve only what the current user may see. Redact personal data before sending to a provider you have not approved. Do not train on customer data without a basis. |
| LLM03 Excessive agency | Give the model the fewest tools, with the narrowest permissions, scoped to the current user. Require human approval for irreversible or costly actions (payments, deletes, sending messages, changing access). Never give it a general shell or arbitrary network access in a product. |
| LLM04 Supply chain (models, datasets, plugins) | Pin model versions and verify provenance. Use trusted registries; do not load untrusted model files that can execute code on load. Review plugins and tool servers like any dependency. |
| LLM05 Data and model poisoning | Control who can write to knowledge bases, fine-tune sets, and feedback loops. Review and version training and retrieval data. |
| LLM06 Unbounded consumption | Limit input size, output size, tool-call depth, retries, and spend per user and per tenant. Alert on cost spikes. Guard against recursion between agents. |
| LLM07 Misinformation | Ground answers in cited sources, show uncertainty, and keep a human in the loop for consequential decisions. Do not present generated output as verified fact. |
| LLM08 Hidden context exposure (named system prompt leakage in 2025) | Assume the system prompt will be extracted. Keep secrets, keys, and access rules out of it. |
| LLM09 Vector and embedding weaknesses | Apply per-tenant and per-user access control **at retrieval time**, inside the vector store query, not by asking the model to hide results. Keep tenants' embeddings separate or filtered. Validate what gets indexed. |
| LLM10 Improper output handling | Treat output as untrusted input to the next system: encode it for HTML, parameterise it for queries, validate it against a schema before it reaches a shell, a file path, a URL fetcher, or an API. |

## Agent and tool design
1. **Tools are an API the attacker can call.** Define each with a strict input schema, validate the arguments, and authorise every call against the end user, not against the agent's own broad credentials.
2. **Use the user's identity,** not a shared service identity, when the agent reads or writes on their behalf.
3. **Confirm before side effects.** Show the exact action and parameters; do not let model-written text be the confirmation.
4. **Break the "lethal trifecta":** an agent that reads untrusted content, has access to private data, and can send data out is an exfiltration path. Remove at least one of the three.
5. **Sandbox code execution:** no network by default, no host mounts, resource limits, short lifetime.
6. **MCP and tool servers:** authenticate them, scope their data, pin their versions, and review tool descriptions, which the model reads as instructions. Keep write-capable servers off by default.
7. **Multi-agent systems:** messages between agents are untrusted too; do not let one agent's output grant another agent permissions.
8. **Log tool calls** (names, arguments with sensitive values redacted, outcomes, user, tenant) so incidents can be reconstructed. Do not log full prompts containing personal data without a retention rule (`core/pii-and-logging.md`).

## Testing
- Keep a set of adversarial prompts (injection, jailbreak, data-extraction, cross-tenant requests) in the test suite and re-run it on every model, prompt, or tool change.
- Test the authorization layer directly: can user A obtain user B's data through the assistant?
- Test limits: very long input, many tool calls, repeated retries.
- Red-team with someone who did not build it, before launch and after significant changes.

## Questions to ask
- What is the worst action the model can trigger, and what stops it besides the prompt?
- Whose identity does each tool call run under?
- What untrusted text reaches the model, and what can it then reach?
- What is the cap on cost and on actions per user per hour?

*Stack-specific notes: `stacks/<stack>/llm-and-agent-security.md` for the detected stack, when present.*
