# React: patching

Companion to `core/patching-cadence.md`. Checked against the React, Node.js, and npm documentation in October 2026.

## React itself
- React states that when it learns of a security vulnerability it releases a backported fix for every major version that is affected. Patch releases (x.y.**z**) are reserved for the most critical bugs and security fixes ([versioning policy](https://react.dev/community/versioning-policy)). The pages checked publish no support-date table for old majors, so do not assume a major you stay on is still supported: read the advisory for the exact fixed version.
- A fix can land as a different patch number on each minor line. The December 2025 Server Components advisory was fixed in 19.0.1, 19.1.2, and 19.2.1 (see `dependency-supply-chain.md`). Staying on an old minor means you must move to the fixed patch of your own line, or to a newer minor.
- Alpha, Canary, and Experimental channels carry no stability guarantee (same page). Do not ship them to production without a reason you can write down.
- Create React App has no active maintainers (see `dependency-supply-chain.md`). A project still on it gets no framework fixes; moving to a maintained build tool is a patching task, not only a convenience.

## Node.js for builds and CI
- Production use should be an Active or Maintenance LTS line; Node.js says LTS typically guarantees critical bug fixes for 30 months in total ([Node.js releases](https://nodejs.org/en/about/previous-releases)). Take the current end dates from that page, not from memory, and put them in the calendar the core document asks for.
- The build runs your dependencies' install scripts and bundler plugins, so an end-of-life Node image in CI is an unpatched execution environment for third-party code.

## npm packages
- `npm audit fix` stays inside the version ranges you declared. `--force` allows changes outside them, including SemVer-major updates, and the npm documentation advises against it without a plan. Some vulnerabilities cannot be fixed automatically and need manual review ([npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit)).
- `npm audit --omit=dev` reports only the packages a production install would include (same page). Read both reports: a development-only finding matters for the build machine, a production finding for the people who open the site.
- A vulnerable transitive package that its parent has not updated is a decision to record: update the parent, replace it, or accept the risk with a date to revisit (general practice).

## Review questions
- Which React minor line is in use, and is it at the fixed patch for every published advisory?
- Does the CI image use a Node.js line that is still in LTS?
- Who owns the audit findings, and what is the response time?

*Statements without a cited page are general practice and were not fetched in this build.*
