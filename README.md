# T-eraClip

**Clip anything. Turn it into action.**

T-eraClip is a local-first Chrome Extension for capturing selected webpage text as structured work items. Users can organize captured items in the popup, generate copy-ready reports and message templates, and manage local backups from the Options page.

## MVP Status

Version 0.1 is a completed local MVP intended for unpacked Chrome Extension demos and manual testing. It is not published to the Chrome Web Store.

The current MVP has passed the full manual regression checklist and includes privacy, typecheck, import-integrity, and stored-data validation hardening.

## Features

- Capture selected webpage text from the right-click context menu
- Preserve the selected text, source URL, source page title, and timestamps
- Store work items in `chrome.storage.local`
- View captured items in a newest-first popup list
- Edit item title, status, priority, and notes
- Filter items by status and priority
- Generate daily, follow-up, waiting, and completed reports
- Generate vendor follow-up, internal follow-up, leadership summary, and meeting action templates
- Copy generated reports and templates to the clipboard
- Save the default report-language preference for future report localization
- Export items and settings as a versioned JSON backup
- Validate and replace local data from a JSON backup
- Clear all local items and settings with confirmation
- Safely ignore invalid stored items during reads

## Local-First Data

T-eraClip stores items and settings in the current Chrome profile using `chrome.storage.local`. Version 0.1 has no account, backend, cloud sync, external database, or cross-device synchronization.

Export important data before clearing extension data, removing the extension, or resetting the browser profile.

## Privacy And Security

- Capture occurs only after the user selects text and chooses **Save to T-eraClip**.
- The extension uses only `storage`, `contextMenus`, and `activeTab` permissions.
- It has no persistent host permissions and injects no content script into webpages.
- Selected text and item contents are not logged by a webpage content script.
- Backup imports are validated before confirmation and replacement.
- Items and settings are written together in one Chrome Storage operation during import.
- Invalid stored items are skipped without logging their contents or rewriting storage.

## Tech Stack

- Chrome Extension Manifest V3
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Chrome Storage API
- Chrome Context Menus API
- Clipboard API

## Project Structure

```text
public/manifest.json             Extension manifest
src/background/index.ts         Context-menu registration and capture
src/popup/                      Popup application
src/options/                    Settings and local data management
src/shared/storage.ts           Chrome Storage access and validation
src/shared/reportGenerator.ts   Report generation
src/shared/templateGenerator.ts Message-template generation
src/shared/types.ts             Shared data types
docs/                           Product, architecture, and release documents
```

## Setup

Requirements:

- Node.js and npm
- Google Chrome or another Chromium-based browser that supports unpacked extensions

Install dependencies:

```bash
npm install
```

Check TypeScript:

```bash
npm run typecheck
```

Build the extension:

```bash
npm run build
```

The unpacked extension is generated in `dist/`.

## Load In Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository's `dist` directory.
6. Confirm T-eraClip loads without manifest errors.

After rebuilding, return to `chrome://extensions` and reload the extension.

## Basic Usage

1. Select text on a normal webpage.
2. Right-click the selection.
3. Choose **Save to T-eraClip**.
4. Open the extension popup to review the captured item.
5. Edit its title, status, priority, or notes as needed.
6. Use filters to narrow the visible list.
7. Generate and copy a report or message template.
8. Open the Options page to manage language preference, backups, or local data.

Reports and templates use all saved items, not only the currently filtered popup results.

## Smoke Checklist

- The unpacked extension loads from `dist` without manifest errors.
- **Save to T-eraClip** appears for selected webpage text.
- A captured item includes its original text, source URL, and source title.
- Popup edits persist after closing and reopening the popup.
- Status and priority filters work, including filtered-empty behavior.
- At least one report and one message template generate and copy successfully.
- Options opens and saves the report-language preference.
- Export, clear, and valid replace-only import complete successfully.
- Invalid JSON or invalid backup schema does not replace existing data.
- Data persists after extension reload or browser restart.

## Known Limitations

- Version 0.1 is distributed only as an unpacked extension.
- Data exists only in the current browser profile unless manually exported and imported.
- Import replaces existing local data; merge import is not supported.
- The saved report-language preference is not yet connected to generated output.
- Item category, due date, owner, tags, and type are present in the data model but are not editable in the popup.
- Items cannot be deleted individually.
- Stored items missing required fields are skipped rather than migrated or repaired.
- Chrome Storage operations are hardened but are not claimed to provide full database-style ACID transactions.
- There is no automated test suite; release validation currently uses typecheck, production build, and manual regression testing.

## Future Backlog

Potential work after v0.1 stabilization:

- Wire report-language preference into report generation
- Add carefully scoped editing for additional item fields
- Add individual item deletion and recovery safeguards
- Add automated tests for storage validation, imports, reports, and templates
- Improve storage concurrency handling
- Evaluate packaging and Chrome Web Store readiness
- Consider optional synchronization or AI only as separately scoped future products

Cloud sync, backend services, login, analytics, and AI are not part of v0.1.

## Development Principles

- Keep the core product local-first and usable without an account.
- Request the minimum Chrome permissions required for current behavior.
- Do not log captured user content.
- Validate external and stored data at runtime.
- Prefer small, reviewable changes that preserve existing behavior.
- Keep build and typecheck commands passing.
- Treat new features as explicit scope decisions rather than incidental additions.

## Project Documentation

- `docs/PRD_v0.1.md`
- `docs/MVP_SCOPE_v0.1.md`
- `docs/ARCHITECTURE_v0.1.md`
- `docs/CODEX_PROMPTS.md`
- `docs/RELEASE_NOTES_v0.1.md`
