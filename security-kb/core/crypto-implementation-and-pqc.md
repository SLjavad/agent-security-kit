# Cryptography implementation pitfalls and post-quantum readiness

Own guidance, written from NIST publications (FIPS 203, 204, 205, SP 800-38D, SP 800-131A, SP 800-208, IR 8547), IETF documents, and library documentation; nothing copied. `core/crypto-and-data-protection.md` covers what to protect and with what class of primitive. This document covers how implementations go wrong and how to prepare for quantum computers.

## Use vetted building blocks
1. Use the platform's or a widely reviewed library's high-level API (authenticated encryption, password hashing, signature verification). Do not assemble primitives, and never invent a scheme.
2. Prefer authenticated encryption (AES-GCM, ChaCha20-Poly1305). Encryption without authentication allows tampering.
3. Do not use broken or legacy algorithms for security: MD5, SHA-1, DES, 3DES, RC4, ECB mode, unpadded RSA, RSA below 2048 bits.

## Implementation pitfalls
| Pitfall | Why it breaks | Do this instead |
|---|---|---|
| Reusing a nonce or IV with the same key (GCM, ChaCha20) | Reveals plaintext relationships and can leak the authentication key | Random 96-bit nonces with a bounded message count per key, or a counter that cannot repeat across restarts and replicas; rotate keys before the limit |
| Predictable randomness | Guessable tokens, keys, nonces | Use the operating system's cryptographically secure generator, never a general-purpose random function or a timestamp |
| Comparing secrets with `==` | Timing differences leak the value | Use a constant-time comparison for MACs, tokens, and hashes |
| Fast hashes for passwords | Brute force is cheap | Argon2id, scrypt, or bcrypt, with parameters tuned to your hardware and reviewed yearly |
| Hard-coded or committed keys | Anyone with the code has the key | Key store or secret manager; separate keys per environment |
| One key for everything | A single leak is total | Separate keys per purpose and per tenant where it matters; derive with a KDF |
| Encrypting without a plan for rotation | Rotation never happens and a leak lasts forever | Envelope encryption with versioned keys; store the key version with the data; rehearse rotation |
| Disabling certificate checks "for testing" | Removes protection against interception | Install a test CA instead; never ship a bypass flag |
| Rolling your own token or session format | Subtle forgery bugs | Use a standard, with the algorithm fixed server-side and the signature verified before any claim is read |
| Using a hash where a MAC is needed | Length-extension and forgery | Use HMAC or a keyed hash |
| Error messages that distinguish padding, MAC, or decrypt failures | Oracle attacks | Return one generic failure |
| Logging keys, tokens, or plaintext | Leaks through logs | Redact at the logging layer (`core/pii-and-logging.md`) |

## Key management
- Keys live in a hardware-backed or managed key service where possible; the application asks it to encrypt, decrypt, or sign instead of holding raw keys.
- Limit who and what can use each key; log key use.
- Define rotation and revocation for every key before launch, and what happens to data encrypted under an old key.
- Keep backups of keys separate from backups of the data they protect.
- Plan for algorithm change (**crypto agility**): store an algorithm identifier and version with each ciphertext, signature, or hash, so you can migrate without a flag day.

## Post-quantum readiness
A sufficiently large quantum computer would break the public-key algorithms in common use today (RSA, finite-field and elliptic-curve Diffie-Hellman, ECDSA). Symmetric encryption and hashes are weakened less; the usual guidance is 256-bit symmetric keys and at least SHA-256.

The risk to act on now is **harvest now, decrypt later**: an attacker records encrypted traffic or data today and decrypts it when the capability exists. It matters most for data that must stay confidential for many years.

Standards: NIST finalised ML-KEM (FIPS 203, key establishment), ML-DSA (FIPS 204, signatures), and SLH-DSA (FIPS 205, hash-based signatures) in August 2024, and has selected a further key-establishment algorithm, HQC, for standardisation. NIST's transition plan (IR 8547, check its current status) proposes deprecating quantum-vulnerable public-key algorithms by 2030 and disallowing them by 2035. Hybrid key exchange, combining a classical and a post-quantum algorithm so both must be broken, is being deployed in TLS; check which versions your libraries and endpoints support.

### What to do now
1. **Inventory** every use of public-key cryptography: TLS endpoints, VPNs, code and artifact signing, token signing, encrypted storage with wrapped keys, device and partner integrations. You cannot migrate what you have not listed.
2. **Classify by confidentiality lifetime.** Data that must stay secret beyond roughly a decade, and anything recorded in transit that is sensitive, goes first.
3. **Enable hybrid key exchange** where your TLS stack and clients support it; keep a classical fallback.
4. **Make algorithms replaceable:** identifiers and versions in stored formats, no algorithm hard-coded in many places, certificate and key sizes not assumed by protocols or databases.
5. **Ask vendors** for their post-quantum roadmap for libraries, cloud key services, HSMs, and certificate authorities.
6. **Do not implement ML-KEM or ML-DSA yourself.** Wait for your platform or a reviewed library, and test sizes: keys, ciphertexts, and signatures are much larger than elliptic-curve ones, which affects packet sizes, handshake time, and storage.
7. Stateful hash-based signatures (SP 800-208) need careful state management; avoid them unless a standard requires them.

## Questions to ask
- Where is each key stored, who can use it, and when was it last rotated?
- Can we change an algorithm without re-engineering the data format?
- Which data would still matter in ten years, and how is it protected in transit today?
- Does every nonce come from a source that cannot repeat?

*Stack-specific notes: `stacks/<stack>/crypto-implementation-and-pqc.md` for the detected stack, when present.*
