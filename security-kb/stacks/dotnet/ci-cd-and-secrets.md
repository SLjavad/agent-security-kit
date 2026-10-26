# .NET: secrets and CI

Companion to `core/ci-cd-and-secrets.md`. From Microsoft Learn ([app secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets), [configuration](https://learn.microsoft.com/aspnet/core/fundamentals/configuration/)), checked October 2026.

## Where secrets may live in an ASP.NET Core app
- Never in `appsettings*.json`, source, or `nuget.config`. Do not use production secrets in development or test, and do not deploy secrets with the app.
- Development: the Secret Manager (`dotnet user-secrets`) or environment variables. User secrets live outside the project tree and load only in the Development environment, after the JSON files, so they override `appsettings`.
- Environment variables are plain text; a compromised machine or process exposes them. Use the `__` separator for hierarchical keys (`Parent__ApiKey`) because `:` fails on some platforms.
- Production: read secrets from a key vault or equivalent secret service (for example the Azure Key Vault configuration provider), authenticated with the workload's identity. Register the secret provider last so it overrides earlier sources.
- The user secrets file is stored outside the project and is not part of build output. Check that nobody copies `secrets.json` into a repository or image.

## CI specifics
- Restore in locked mode with audit errors enabled (`dependency-supply-chain.md`), using the `templates/Directory.Build.props` settings with the `CI` variable set.
- Use a credential provider or CI-injected token for private feeds; never commit feed credentials.
- Pin the SDK image by digest. `templates/gitlab-ci-dependency-audit.yml` shows a restore-and-report job. The generic secret scan job is `../../templates/gitlab-ci-secret-scan.yml`.
- Do not upload `appsettings.Production.json`, `*.pfx`, or `secrets.json` as artifacts.

## Review questions
- Which environment variables hold secrets in each environment, and who can read them?
- Does anything call `AddUserSecrets` outside Development?
- Are connection strings composed from configuration at runtime, with no credentials in the repository?

*Statements without a cited Learn page are general practice and were not fetched in this build.*
