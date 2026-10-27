# Privacy assessment and data subject requests

Own guidance, written from the text of the GDPR and regulator guidance; nothing copied. This is engineering input, **not legal advice**: have your privacy or legal owner confirm which laws apply (`core/compliance-conditional.md`) and the exact deadlines. Where data lands in logs, see `core/pii-and-logging.md`.

## Know your data first
Keep a living **record of processing**: for each system, what personal data it holds, whose it is, why it is processed, the legal basis, who receives it, where it is stored, and how long it is kept. Most privacy work fails because nobody knows where the data is. Include:
- Databases, caches, search indexes, and message queues.
- Logs, traces, analytics events, and error reports.
- Backups and exports, files and attachments.
- Third parties and processors (payment, email, support, analytics, AI providers) and any country the data is sent to.

## Assess new or changed processing
Run a short assessment before building, and a full impact assessment when the processing is likely to be high risk (large scale, sensitive categories, profiling or automated decisions, systematic monitoring, children's data, new technology).
1. What data, and is every field needed? Remove what is not (minimisation).
2. What is the purpose and the legal basis, and is the new use compatible with what people were told?
3. Who can access it, and is access limited to need?
4. Where is it stored and sent, and is there a transfer outside the region that needs a mechanism?
5. How long is it kept, and what deletes it?
6. What could go wrong for the person (not only for the company), how likely, and what reduces it?
7. Do we need to update the privacy notice, the processor agreements, or the record of processing?
Record the answers and the decision. Revisit when the design changes.

## Design rules that make requests cheap
- One identifier per person that links their data across systems, so a request can find everything.
- Personal data in as few stores as possible; reference it by ID elsewhere.
- Retention set per data type with automatic deletion, including logs and backups' expiry.
- Soft-delete only with a hard-delete job behind it.
- Export in a structured, common format as a built-in feature, not a one-off script.
- Pseudonymise or aggregate for analytics and testing; never copy production personal data into test environments.

## Handling a data subject request (access, deletion, correction, portability, objection)
1. **Log it on receipt** with date, requester, and type. The clock starts when you receive it; under the GDPR the usual limit is one month, extendable in complex cases, but confirm with your privacy owner.
2. **Verify identity** proportionately, using information you already hold. Do not collect more personal data than needed to verify; never act on an unverified request to disclose or delete.
3. **Search every store** in the record of processing, including processors, logs, and files. Use the person's identifiers (account ID, email, phone, device IDs).
4. **Decide per item:** provide, delete, correct, or refuse with a stated reason. Exemptions exist (legal obligations, other people's data, legal claims); a person must be able to be told which applied.
5. **Protect other people.** Redact third parties' data from an access export.
6. **Deliver securely:** an authenticated channel or an expiring link, not plain email attachments of sensitive data.
7. **Deletion:** delete in primary stores, instruct processors, and let backups age out under a documented schedule; do not restore deleted data from backups into live systems without re-applying deletions.
8. **Tell the person what you did,** and keep a minimal record that the request was handled.

## Breaches
Have a procedure before you need it: who decides, how to assess risk to people, and who notifies the regulator and the affected people. The GDPR sets a short window for notifying the regulator after becoming aware (72 hours), so the first hours matter. See `core/threat-model-and-ir.md`.

## Pitfalls
- Deleting from the main database but not from search indexes, caches, analytics, or logs.
- Backups that restore deleted users.
- Test and staging environments holding real personal data.
- Verifying identity by asking for a passport copy that you then store forever.
- Treating consent as the only legal basis, or consent bundled into terms.
- Sending personal data to an AI or analytics provider with no agreement and no entry in the record.

## Questions to ask
- Which laws apply to our users, and who owns the answer?
- Can we find all of one person's data in under a day?
- What deletes personal data automatically, and when?
- Which processors hold personal data, and is each in the record?

*Stack-specific notes: `stacks/<stack>/privacy-assessment-and-dsar.md` for the detected stack, when present.*
