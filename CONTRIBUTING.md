# Contributing

Issues and pull requests are welcome. Include the Windows, Zotero, and reMarkable desktop versions when reporting an import problem. Redact personal file paths and do not attach account credentials or private documents.

## Development checks

Use Node.js 20+ and Windows PowerShell 5.1+. No dependency installation is required.

```powershell
npm test
npm run build
npm run verify:package
npm run audit:public
```

The public-file audit examines Git-tracked files, including newly staged files. It rejects private profile files, development-machine home paths, and common credential formats. Keep experiments and isolated test profiles in the ignored `.work/` folder. Builds belong in the ignored `dist/` folder.

For manual integration checks, use a separate Zotero profile and data directory. Use headless mode whenever possible and a synthetic PDF. Verify menu visibility, the preferred attachment, and the desktop destination. Record actual versions and distinguish a successful desktop handoff from cloud/tablet sync. Do not test against a contributor's real library or stored account credentials.

The stable plugin ID is retained from the original local build so installed copies are recognized as the same extension. It is an opaque identifier, not a user account or filesystem path.

## Release

1. Update the version in both `package.json` and `src/manifest.json`. Adjust Zotero compatibility only after checking it.
2. Run all development checks. Review `git diff --cached` and the tracked-file list before pushing.
3. Push the reviewed commit and create a matching `v<version>` tag.
4. Publish a GitHub release for that tag with the generated XPI, `updates.json`, and `SHA256SUMS` from the same build. The plugin update address points to the latest release's `updates.json` asset.
5. Verify the downloadable XPI's checksum against the published update metadata.

Fork maintainers should change `package.json`'s repository URL and the manifest's homepage/update URLs to their own repository before publishing releases. The build reads the repository URL from `package.json`. Retain the plugin ID for compatible upgrades, or choose a different ID for a separate extension.
