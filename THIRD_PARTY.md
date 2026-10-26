# Third-party sources

This kit does not contain third-party files. `tools/fetch-third-party.cjs` fetches them at the commits pinned in `third-party/lock.json`. Re-read the files and update the pins deliberately; never track a branch.

| Id | Source | Licence | Pinned commit | Used for | Review state |
|---|---|---|---|---|---|
| cloudflare-security-audit | https://github.com/cloudflare/security-audit-skill | MIT | `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` | `skills/security-audit` (tier 2 and 3 method) | partial: SKILL.md and README read; companion files not fully read |
| agamm-owasp | https://github.com/agamm/claude-code-owasp | MIT | `8ac7965caa212b4a850aff8d3df0081ab3fa9eed` | `skills/owasp-security` | partial: front matter and layout read |
| trailofbits-skills | https://github.com/trailofbits/skills | CC-BY-SA-4.0 | `196a9073ab10d35bacf111f945e02c00b2c6883a` | Plugins: differential-review, insecure-defaults, sharp-edges, audit-context-building, variant-analysis, fp-check | partial |
| mukul975-curated | https://github.com/mukul975/Anthropic-Cybersecurity-Skills | Apache-2.0 | `54a798831d2266a3ca61ce68a7acb80b81160d57` | 34 skills as reference material under `security-kb/curated/` | none: names verified to exist; contents not read |
| masriyan-curated | https://github.com/Masriyan/Claude-Code-CyberSecurity-Skill | MIT (see its NOTICE: attribution required in redistributions) | `3aa77d84fb64cf07b550f6be4544bb91292db89f` | Skills 09, 13, 19, 20 as reference material | none |

## Changes applied after fetching

- Trail of Bits `fp-check`: the `hooks/` directory is removed, so its Stop-hook prompts are not installed.
- Trail of Bits `differential-review` agent `adversarial-modeler` and `fp-check` agent `poc-builder`: the `tools` line is replaced by `Read, Grep, Glob` (read-only).
- Curated mukul975 and Masriyan skills: each `scripts/` directory is removed; only the instruction files and references are kept.

## Licence notes

- Trail of Bits material is CC-BY-SA-4.0. Private use is unaffected. If you redistribute adapted text, share-alike and attribution apply. The patched copies are adaptations.
- Apache-2.0 requires keeping the licence and any notices when you redistribute. Each fetched skill keeps its own `LICENSE` file when it ships one.
- The Masriyan project asks that copies keep its copyright notice, `LICENSE`, and `NOTICE`. Do not redistribute fetched files without them.
- Windows Defender flagged one script in the Masriyan repository as malware during review (payload templates for security testing). Scripts are excluded here, but the `examples/` folders of its skills are not reviewed.

## Not copied

Microsoft Learn and OWASP pages are cited by link in the reference documents. No text is copied from them.
