# Historical integration checks

These sanitized records describe runtime checks of local version 1.0.0 on Windows using isolated headless Zotero 10.0.8 profiles. No user profile paths, library IDs, or account credentials are included.

The runtime test intercepted the operating-system process launch to avoid repeated imports. A separate handoff of a synthetic PDF to reMarkable desktop 3.29.0 confirmed an import into My files; tablet/cloud sync was not verified.

Public version 1.0.1 keeps the same `bootstrap.js` and `remarkable.js` runtime code. Packaging, release-update configuration, licensing, documentation, and automated verification were prepared for public distribution. Current package verification is provided by `npm run verify:package` and the repository's CI workflow.
