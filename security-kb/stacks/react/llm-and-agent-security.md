# React: showing model output in the interface

Companion to `core/llm-and-agent-security.md`. Checked against the OWASP GenAI documentation in October 2026. It covers a React front end for a chat or assistant feature; prompt handling and tool permissions belong to the back end.

## Treat model output as untrusted input
- OWASP lists improper output handling as a risk: model output passed on unchecked can produce cross-site scripting in the browser. Its advice is to treat the model as an untrusted user, encode output for the place it is used, and add a strict Content Security Policy ([OWASP LLM05](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/)).
- React escapes text placed in JSX children, so render model output as plain text where you can. The risk returns when you convert it to HTML. A Markdown renderer that allows raw HTML, or a call to `dangerouslySetInnerHTML` with its output, turns a crafted answer into script. Use a renderer configured to drop raw HTML, or sanitize the HTML it produces (see `injection-deserialization-memory.md`) (general practice).

## Links and images
OWASP's page points to research titled "Markdown images can steal your chat data": an image that loads automatically can carry data to another host in its address. Limit where images and links in model output can point, with an `img-src` rule in the Content Security Policy and an allow-list when you render the Markdown (see `hardening-network-server.md`) (general practice).

## Actions
Do not let a response trigger a state-changing call by itself, such as sending a message, buying, or deleting. Show the action and ask the user to confirm, and let the back end re-check the user's permission (see the core document and `authz-and-tenant-isolation.md`) (general practice).

## Keys and logs
- A provider key in the bundle is public (see `abuse-and-integrations.md`). Call the model from a back end.
- Prompts and answers often hold personal data. Apply `pii-and-logging.md` to them before they reach an analytics or error tool.

## Review questions
- How is model output rendered: as text, as Markdown, or as HTML? Can the renderer emit raw HTML?
- Can an image or link in an answer point to any host?
- Can an answer cause an action without a click from the user?

*Statements without a cited page are general practice and were not fetched in this build.*
