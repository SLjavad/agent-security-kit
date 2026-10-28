# .NET: cryptography APIs and Data Protection

Companion to `core/crypto-and-data-protection.md`. Microsoft Learn facts checked October 2026. Use current published guidance for work factors and key sizes; do not copy numbers from old code.

## Choosing APIs
| Need | .NET |
|---|---|
| Password storage | `Rfc2898DeriveBytes.Pbkdf2` with a SHA-2 hash, or ASP.NET Core Identity's `PasswordHasher` |
| HMAC | `HMACSHA256` or stronger, `HMACSHA256.HashData` |
| Signatures | `ECDsa` or `RSA` with SHA-2. For post-quantum signatures, `MLDsa` exists in .NET 10 and its availability depends on the operating system ([cross-platform cryptography](https://learn.microsoft.com/dotnet/standard/security/cross-platform-cryptography)) |
| Authenticated encryption | `AesGcm` or `ChaCha20Poly1305`, unique nonce per message |
| Cookies, anti-forgery, short-lived tokens | ASP.NET Core Data Protection (`IDataProtector`) |
| Random bytes | `RandomNumberGenerator` (not `Random`; not `Guid.NewGuid()` for secrets) |
| Constant-time comparison | `CryptographicOperations.FixedTimeEquals` |

- `Rfc2898DeriveBytes.Pbkdf2` is a static one-shot method with overloads for strings, byte arrays, and spans; supported hashes are SHA-1, SHA-256, SHA-384, and SHA-512 ([Pbkdf2](https://learn.microsoft.com/dotnet/api/system.security.cryptography.rfc2898derivebytes.pbkdf2)). Use SHA-256 or stronger.
- `FixedTimeEquals` compares in time that depends on length but not content; it returns false early only when the lengths differ ([FixedTimeEquals](https://learn.microsoft.com/dotnet/api/system.security.cryptography.cryptographicoperations.fixedtimeequals)).

## Analyzer rules
Enable the security category with `AnalysisModeSecurity` (`templates/Directory.Build.props`) and set severities with `templates/editorconfig-security.snippet`.
- CA5350: weak algorithms (3DES, SHA-1, RIPEMD160) ([CA5350](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/ca5350)).
- CA5373: obsolete key derivation (`PasswordDeriveBytes`, `Rfc2898DeriveBytes.CryptDeriveKey`); use PBKDF2 with SHA-2 ([CA5373](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/ca5373)).
- SYSLIB0041: obsolete `Rfc2898DeriveBytes` constructors whose defaults are no longer secure ([SYSLIB0041](https://learn.microsoft.com/dotnet/fundamentals/syslib-diagnostics/syslib0041)).
- Most security rules are not enabled by default in .NET 10. Setting `AnalysisMode` to `All` ignores bulk `dotnet_analyzer_diagnostic` settings in `.editorconfig`, so enable a category with `AnalysisModeSecurity` and tune single rules with `dotnet_diagnostic.CAxxxx.severity` ([configuration options](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/configuration-options)).
- Search patterns: `MD5.Create`, `SHA1.Create`, `new MD5CryptoServiceProvider`, `TripleDES`, `DES`, `Aes.Create()` with `Mode = CipherMode.ECB`, `new Random(`, `DangerousAcceptAnyServerCertificateValidator`, `ServerCertificateCustomValidationCallback = ... => true`.

## ASP.NET Core Data Protection
From [default settings](https://learn.microsoft.com/aspnet/core/security/data-protection/configuration/default-settings), [configuration](https://learn.microsoft.com/aspnet/core/security/data-protection/configuration/overview), and [key encryption at rest](https://learn.microsoft.com/aspnet/core/security/data-protection/implementation/key-encryption-at-rest):
- Keys default to a 90-day lifetime; retired keys remain so old data can be decrypted.
- Default key storage and protection depend on the host: Azure App Service keeps keys in a synchronised folder without encryption at rest; with a user profile on Windows keys are encrypted with DPAPI; under IIS they sit in a registry key encrypted with DPAPI; if nothing matches, keys are not persisted and are lost when the process stops.
- Specifying an explicit key persistence location deregisters the default encryption of keys at rest. Choose an encryption mechanism for production explicitly: `ProtectKeysWithDpapi`, `ProtectKeysWithCertificate`, or a key vault.
- Protect the key ring with file or blob permissions limited to the app identity. Encrypting at rest does not stop an attacker who can write new keys.
- Apps that share a key ring share trust, and compromise of one is compromise of all. Use separate repositories for apps that must stay isolated.
- Containers and web farms need a shared persistent key ring (a volume or external store), and deployment slots do not share one by default, which signs users out on swap.
- Set `SetApplicationName` consistently when several instances or apps must read the same payloads.

*Statements without a cited Learn page are general practice and were not fetched in this build.*
