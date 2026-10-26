# Compliance scoping (conditional)

This document helps you ask the right questions. It is not legal advice, and the answers belong to your compliance or legal owner. General practice; no fetched sources.

## Why scope first
A framework applies because of what you handle and where you operate, not because it sounds relevant. Over-scoping wastes effort; under-scoping creates legal and contractual exposure.

## Scoping questions
1. **Payment card data.** Do card numbers, expiry dates, or security codes ever reach your servers, logs, or backups? If you redirect to a hosted payment page or use tokenisation so they never do, say so explicitly and keep it that way. If they do, a card-industry standard (PCI DSS) is likely to apply, and the scope is every system that stores, processes, or transmits the data.
2. **Personal data.** Whose personal data do you hold (customers, guests, employees), in which countries do those people live, and where are you established? These decide which privacy laws apply, what lawful basis you need, what rights people have, and notification deadlines.
3. **Sensitive categories.** Health, biometric, children's data, identity documents, precise location, financial account data. Each tightens obligations.
4. **Data location.** Where is the data stored and processed, and who are your processors and sub-processors? Some laws and contracts restrict transfers or require local storage.
5. **Sector rules.** Do you act as a regulated entity (payments, banking, insurance, health, telecom) or serve one? Regulated customers pass obligations down by contract.
6. **Customer contracts and questionnaires.** What security commitments have you signed (encryption, audit rights, breach notification times, penetration test frequency, certification such as ISO 27001 or SOC 2)?
7. **Retention and deletion.** What must you keep (tax, audit) and what must you delete, and by when?
8. **Incident notification.** Who must be told after a breach, and within what time? Put the deadlines in the response runbook (`threat-model-and-ir.md`).
9. **Evidence.** Which controls will an auditor ask you to prove, and where does the proof live (tickets, logs, configuration, policies)?

## Output
A short table:

| Obligation | Source (law, standard, or contract) | Applies because | Owner | Evidence | Gap |
|---|---|---|---|---|---|

Mark every row you cannot answer as "needs compliance owner".

## How this connects to engineering
- Smaller scope is cheaper. Keep regulated data out of systems that do not need it, and out of logs (see `pii-and-logging.md`).
- Many obligations reduce to controls this kit already covers: access control, encryption, logging, patching, incident response, supplier management.

*Stack-specific notes: `stacks/<stack>/compliance-conditional.md` for the detected stack, when present.*
