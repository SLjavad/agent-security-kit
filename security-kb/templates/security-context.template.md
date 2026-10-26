# Security context

Copy this file to `.claude/security-context.md` in a project and fill it in. It tells the security skills what matters here. Keep it in the project's own private repository. Do not copy it into public repositories or shared kits.

## Project
- Name and purpose:
- Frameworks and runtime versions:
- Owner and security contact:

## Environments
- Environments (development, staging, production) and how each is identified in configuration:
- What is real in production and must never be exercised by tests:

## Critical paths (tier 2 audits start here)
List folders, endpoints, or services, in priority order.
1.
2.
3.

## Value and identity flows
- Flows that move money, credits, or entitlements, and their states:
- Flows that create or change identities, credentials, or permissions:

## Tenants and data ownership
- Tenant model (single database with tenant column, database per tenant, other):
- Who may see whose data:

## Test and simulation modes
- Modes or flags that fake or relax behaviour, and how they are prevented in production:

## Sensitive data
- Data types held (personal, financial references, tokens) and where each is stored or logged:
- Fields that must never appear in client responses or logs:

## Trust boundaries and external parties
- Partners, suppliers, payment or identity providers, and how each is authenticated:
- Callbacks and webhooks received:

## Accepted risks
| Risk | Reason accepted | Owner | Review date |
|---|---|---|---|

## Out of scope for reviews

## Notes for reviewers
