# Container and orchestrator hardening

Own guidance, written from NIST SP 800-190, the CIS Docker and Kubernetes benchmarks, and the Docker and Kubernetes documentation; nothing copied. It covers images, runtime settings, and the orchestrator. Secret handling in pipelines is in `core/ci-cd-and-secrets.md`; scanning tools are in `core/ci-security-tooling.md`.

## Image
1. **Choose a small, maintained base.** Fewer packages mean fewer vulnerabilities and fewer tools for an attacker. Use the vendor's official or a distroless or minimal image; avoid a full OS image when a runtime image will do.
2. **Pin the base by digest,** with the tag in a comment for humans. A tag can move; a digest cannot. Update the digest on a schedule and rebuild (`core/patching-cadence.md`).
3. **Build in stages.** Compilers, package managers, and test tools stay in the build stage; the final stage holds only what runs.
4. **Run as a non-root user** that you create in the image, with a fixed numeric ID.
5. **No secrets in the image.** Not in layers, `ENV`, build arguments, or copied files; image history shows all of them. Use the build system's secret mount for build-time secrets and inject runtime secrets from a secret store.
6. **Copy only what is needed.** Use an ignore file so `.git`, `.env`, key files, and local config never enter the build context.
7. **Do not include SSH servers, debug shells, or package managers** in production images.
8. **Add a health check and set a stop signal** so the platform can restart and stop the process cleanly.
9. **Lint the build file** (for example with hadolint) and scan the built image for vulnerable packages before pushing.
10. **Label the image** with the commit and build ID so you can say what is running.

## Runtime
- Read-only root filesystem, with writable temporary volumes only where needed.
- Drop all Linux capabilities and add back only the ones required.
- No privileged mode, no host network, no host PID or IPC namespaces.
- `no-new-privileges` set; default seccomp profile kept on (do not run unconfined).
- **Never mount the container runtime socket** into a container. It is root on the host.
- Avoid host-path mounts; where unavoidable, mount read-only and narrow.
- Set memory, CPU, and process limits so one container cannot starve the host.
- Keep the host and runtime patched; a container shares the host kernel.

## Registry
- Private registry with authentication and least-privilege push rights; CI pushes, humans do not.
- Immutable tags for releases, or deploy by digest.
- Remove old images and scan stored images on a schedule, since new advisories arrive after the build.

## Orchestrator (Kubernetes concepts, adapt to your platform)
- Enforce the **restricted** Pod Security Standard at namespace level; make exceptions explicit and reviewed.
- Default-deny network policies, then allow only required paths, including egress.
- A dedicated service account per workload, with no automatic token mount unless the workload calls the API; least-privilege roles, no cluster-admin for applications.
- Secrets come from an external secret store or encrypted at rest with restricted read access; do not put them in plain manifests or config maps.
- Resource requests and limits on every workload; quotas per namespace.
- Admission policy to block unsigned or unscanned images, `latest` tags, privileged pods, and host mounts.
- Restrict access to the API server and the node management ports; enable audit logging.
- Keep manifests and charts in version control and scan them (`core/ci-security-tooling.md`).

## Common mistakes
- Running as root "because it was easier".
- A pinned tag but an unpinned base, so builds differ week to week.
- A secret passed as a build argument and visible in the image history.
- The runtime socket mounted for a CI job, giving the job root on the host.
- Scanning at build time only, then never again.

*Stack-specific notes: `stacks/<stack>/container-hardening.md` for the detected stack, when present.*
