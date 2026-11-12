# Send to reMarkable for Zotero

Send a PDF from Zotero to **My files** using the official reMarkable Windows desktop app.

Right-click a PDF attachment or a library item with a PDF, then choose **Send to reMarkable**. The original stays in Zotero. The desktop app handles the import and subsequent tablet sync.

## Requirements

- Windows with Zotero **9.0.x or 10.0.x**.
- The official reMarkable desktop app, already installed and paired with your account.
- A PDF attachment available locally or through Zotero's configured file sync.

The desktop handoff was verified with reMarkable **3.29.0**. Its file-argument import is observed app behavior, rather than a publicly documented API, and may change in future versions. macOS and Linux are not supported.

## Install

1. Download the `.xpi` file from the [latest release](https://github.com/MatanEcon/zotero-remarkable-desktop/releases/latest). Download the installer asset, rather than GitHub's source-code ZIP.
2. In Zotero, open **Tools → Plugins**.
3. Open the gear menu, choose **Install Plugin From File…**, and select the downloaded `.xpi`.
4. Accept Zotero's installation prompt.

Public releases include Zotero update metadata. Once this public build is installed, Zotero can check this repository's releases for updates. Early local builds that used a placeholder update address must be upgraded manually once.

## Use

Select one document, right-click it, then choose **Send to reMarkable**.

- For a library item, Zotero's preferred PDF is used. To send another attachment, right-click that PDF directly.
- If a stored PDF is missing locally, the extension asks Zotero to download it using the library's existing sync configuration.
- A missing linked file must first be repaired in Zotero.
- The reMarkable app opens if needed. Documents import into **My files**, the top-level default folder.

The extension detects the app using the current user's Windows environment variables. It supports the usual system and per-user installation folders, on any drive. If detection fails, a file picker asks you to locate `reMarkable.exe` and remembers that choice in your own Zotero preferences. No username, home directory, or development-machine path is embedded in the extension.

## Limitations

- Send one document at a time. Sending the same PDF again can create a duplicate.
- The underlying PDF is sent. Annotations stored separately in Zotero are not flattened into it.
- There is no return sync for annotations or custom destination-folder setting.
- “Sent to reMarkable desktop” confirms the handoff to the app. It does not confirm successful cloud or tablet sync.

## Privacy

The extension passes the PDF path directly to `reMarkable.exe` as one Unicode process argument. It does not use a command shell, copy account tokens, or provide a separate cloud client. It has no telemetry. The official desktop app manages its own account connection and sync; Zotero manages file downloads and GitHub release-update checks.

## Develop

On Windows, install Node.js **20 or later** and Windows PowerShell **5.1 or later**. Clone the repository into any folder:

```powershell
git clone https://github.com/MatanEcon/zotero-remarkable-desktop.git
cd zotero-remarkable-desktop
npm test
npm run build
npm run verify:package
```

There are no npm dependencies to install. Run commands from the project folder. The build resolves its paths from the script's location and writes these files into `dist/`:

- `zotero-remarkable-desktop-<version>.xpi`
- `updates.json`, including the installer SHA-256 hash and Zotero compatibility bounds
- `SHA256SUMS`

Source is in `src/`, tests in `tests/`, and build tools in `scripts/`. Test paths are fictional fixtures; production path detection uses environment variables. Private scratch work and generated files are excluded from Git. See [CONTRIBUTING.md](CONTRIBUTING.md) for verification and releases.

## Verification

Automated tests cover preferred-PDF selection, downloads, file-picker cancellation, missing files, launch failures, Unicode paths, and different Windows installation layouts. Package checks inspect the actual XPI contents, manifest, checksum, and release-update metadata.

Earlier runtime checks loaded the extension into an isolated headless Zotero **10.0.8** profile, rendered its menu, and dispatched the command with the process launch intercepted. A separate synthetic-PDF handoff to reMarkable **3.29.0** confirmed the root destination. Tablet sync was not verified. Zotero 9 compatibility is based on inspection of its APIs; the live runtime checks used Zotero 10. Public release 1.0.1 retains that runtime code and updates packaging, release metadata, and documentation. Sanitized historical results are in [docs/verification/](docs/verification/).

## License and affiliation

[MIT](LICENSE). This is an independent community extension, unaffiliated with Zotero or reMarkable. Their names and trademarks belong to their respective owners.

References: [Zotero menu API](https://www.zotero.org/support/dev/zotero_8_for_developers#custom_menu_items), [Zotero plugin lifecycle and updates](https://www.zotero.org/support/dev/zotero_7_for_developers), [reMarkable desktop imports](https://support.remarkable.com/articles/Knowledge/importing-and-exporting-files).
