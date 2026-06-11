# T-eraClip v0.1 Release Notes

**Release type:** Local MVP / unpacked Chrome Extension demo

T-eraClip v0.1 is a local-first Chrome Extension MVP for capturing selected webpage text and turning it into manageable work items. This release is intended for local installation, demonstrations, and manual validation. It is not a Chrome Web Store release.

## Completed Features

- Right-click capture of selected webpage text
- Source URL, source page title, and timestamp preservation
- Local item and settings storage in `chrome.storage.local`
- Popup loading, empty, error, filtered-empty, refresh, and item-list states
- Newest-first item display
- Title, status, priority, and notes editing
- Status and priority filtering
- Daily, follow-up, waiting, and completed reports
- Vendor follow-up, internal follow-up, leadership summary, and meeting action templates
- Clipboard copy for generated reports and templates
- Options page with default report-language preference
- Versioned JSON backup export
- Validated, replace-only JSON import
- Confirmed clearing of all local items and settings

## Hardening Completed

- Reduced permissions to `storage`, `contextMenus`, and `activeTab`
- Removed persistent host permissions and the unused webpage content script
- Removed selected-text logging from webpages
- Added `npm run typecheck`
- Removed the overlapping TypeScript project reference that caused `TS6305`
- Changed import to write items and settings in one Chrome Storage operation
- Added runtime validation for stored items
- Added non-sensitive warnings for invalid stored-data shapes and counts
- Confirmed production builds remain Manifest V3 compatible
- Completed the full manual regression checklist with no P0 blockers

## Local Data And Privacy

All v0.1 data is stored in the user's current browser profile through `chrome.storage.local`. T-eraClip does not use a login, backend, cloud service, external database, analytics service, AI service, or API key.

Users should export a JSON backup before clearing extension data, removing the extension, or resetting the browser profile.

## Known Limitations

- Distributed as an unpacked extension only
- No Chrome Web Store publication
- No cross-device or cloud synchronization
- Import replaces existing data and does not merge backups
- Report-language preference is stored but not yet applied to generated output
- No individual item deletion
- No popup editing for category, due date, owner, tags, or item type
- Legacy or corrupted items missing required fields are skipped, not migrated
- Chrome Storage hardening is not a claim of full ACID transaction support
- Concurrent storage actions may still race in uncommon overlapping workflows
- No automated test suite is included in v0.1

## Not Included In v0.1

- Login or user accounts
- Backend services
- Cloud backup or synchronization
- AI generation or classification
- API keys
- Analytics or telemetry
- External database
- Team workspaces or collaboration
- Payment or subscription features
- Merge import or version migration system

## Install And Demo

1. Install dependencies with `npm install`.
2. Run `npm run typecheck`.
3. Run `npm run build`.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Select **Load unpacked** and choose the generated `dist` directory.
7. Open a normal webpage and select text.
8. Right-click and choose **Save to T-eraClip**.
9. Open the popup to edit the item and generate a report or template.
10. Open Options to export, import, or clear local data.

## Suggested Next Steps

- Run the documented smoke checklist against the final packaged build
- Add focused automated tests for storage validation and backup import
- Improve storage concurrency handling
- Connect report-language preference to generated reports
- Evaluate individual deletion and additional field editing as separately scoped work
- Prepare icons, packaging checks, and store-listing materials before considering Chrome Web Store submission
