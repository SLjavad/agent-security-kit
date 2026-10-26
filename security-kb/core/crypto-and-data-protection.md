# Cryptography and data protection

Applies to any language. Library names, analyzer rules, and key-management features are in the stack document. For numeric parameters (iteration counts, key sizes, memory costs) use current published guidance at the time you implement, for example the OWASP cheat sheets; do not copy numbers from old code. Items marked (general practice) are not from a fetched source.

## First rule
Do not design or implement primitives or protocols. Use the platform's standard library or a well-reviewed library, and use the highest-level API that fits the need.

## Choose the right tool

| Need | Use | Not |
|---|---|---|
| Store a password | A slow, salted password-hashing function (Argon2id, scrypt, bcrypt, or PBKDF2 with a SHA-2 hash) or the framework's built-in password hasher | Plain hash, MD5 or SHA-1, fast hashes, encryption |
| Check integrity or authenticity with a shared secret | HMAC (SHA-256 or stronger) | Plain hash of secret plus data |
| Prove origin to others, no shared secret | Digital signature | HMAC |
| Hide data that must be read back | Authenticated encryption (AES-GCM, ChaCha20-Poly1305, or equivalent) with unique nonces | ECB, or CBC without authentication; home-made schemes |
| Protect cookies, anti-forgery tokens, short-lived opaque tokens | The framework's data-protection facility | Custom encryption |
| Protect data in transit | TLS | Application-level obfuscation |
| Fingerprint non-secret data, deduplicate | SHA-256 or stronger | Using it as a security control for secrets |
| Random values for tokens, keys, nonces | The operating system's cryptographically secure generator | General-purpose random number generators, UUIDs for secrets |

## Review checklist
1. Search for MD5, SHA-1, DES, 3DES, RC4, ECB, general-purpose random generators, hard-coded keys and initialisation vectors, and custom `encrypt` and `decrypt` helpers.
2. Passwords use a slow salted function with a unique salt per password and a work factor set from current guidance, with a plan to raise it over time.
3. Secret comparisons (MACs, tokens, API keys) use a constant-time comparison function.
4. Each encryption uses a fresh nonce or IV; nonce reuse with GCM-style modes breaks them. (general practice)
5. Keys are not in source or configuration files. They come from a key store or managed service with rotation and an access list. (general practice)
6. Tokens (JWT and similar): verify signature, issuer, audience, expiry, and algorithm against an allow-list; never accept the `none` algorithm; keep lifetimes short; decide how revocation works. (general practice)
7. Certificate validation is never disabled in production code. Search for "accept all certificates" callbacks and flags.
8. TLS settings follow platform defaults unless a documented requirement says otherwise.

## What to encrypt, hash, or sign: a data classification pass
1. List data elements: credentials, tokens, personal data, financial references, business secrets, public data.
2. For each: must the system read it back? (encrypt) Is it only compared? (hash) Must others verify origin? (sign).
3. Decide protection in transit (TLS everywhere), at rest (disk and database encryption, plus field-level encryption for the highest-risk elements), and in backups and exports.
4. Decide who can use the key, not only who can read the ciphertext. Field encryption with a key in the same database protects little.
5. Encryption protects against theft of storage. It does not protect against a compromised application that can call the decryption key.

## Key management (general practice)
- One owner per key, an inventory, and rotation that has been tested.
- Separate keys per purpose and environment.
- Applications that share a key ring share trust: compromise of one is compromise of all. Use separate key stores for components that must stay isolated.
- Back up keys separately from the data they protect, and test recovery.

## Obfuscation
Obfuscation is not a security control. It raises the effort to read code and does not stop a determined person. Server-side code you do not distribute does not need it. For software you ship to users (desktop, mobile, plug-ins), assume everything inside can be extracted: keep secrets and critical decisions on the server, and use obfuscation only as an extra to deter casual copying, never to protect keys or licence checks.

## In memory
Minimise how long and where secrets are held, never write them to logs, and prefer opaque handles to credentials stored outside the process over copies in application memory.

*Stack-specific notes: `stacks/<stack>/crypto-and-data-protection.md` for the detected stack, when present.*
