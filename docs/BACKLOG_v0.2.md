# T-eraClip Backlog v0.2

## 1. Current Baseline

T-eraClip v0.1 is a completed local-first Chrome Extension MVP, tagged
`v0.1.0-local-mvp`.

The current release supports:

- Right-click capture of selected webpage text
- Local storage in `chrome.storage.local`
- Popup item listing
- Status editing
- Title, priority, and notes editing
- Status and priority filters
- Simple report generation
- Copy-ready message templates
- Clipboard copy
- Options page with a saved default report-language setting
- Versioned JSON backup export
- Validated, replace-only JSON import
- Clearing all local data with confirmation
- Permission and privacy hardening
- Typecheck hardening
- Single-operation import hardening
- Runtime validation of stored items

The saved report-language setting is not yet connected to generated reports or
templates. Category, owner, due date, tags, and type may exist in the item data
model, but they are not all editable or filterable in the current user
interface. These limitations are backlog items, not existing capabilities.

## 2. v0.2 Product Goal

Version 0.2 should improve local productivity through stronger item management
and focused usability polish. The release should make captured items easier to
maintain, find, prioritize, and turn into useful copy-ready output without
changing the local-first product model.

Version 0.2 must remain a small Chrome Extension release. It must not introduce
accounts, cloud services, AI, or a general-purpose task-management platform.
Features outside the priorities and acceptance criteria below require an
explicit scope decision rather than being added incidentally.

## 3. Prioritization Rules

### P0 - Required for v0.2

P0 items define the minimum v0.2 release. They address core item management,
basic due-date visibility, filtering, and completion of the existing language
setting. A v0.2 release candidate is not complete while a P0 item is unfinished
or has a known release-blocking defect.

### P1 - Important polish

P1 items improve usability, resilience, and presentation after P0 is stable.
They should be completed when they fit the release schedule without delaying or
destabilizing the P0 scope. A P1 item may move to a later patch release if it
threatens release focus.

### P2 - Optional or preparatory

P2 items are useful enhancements or future-release preparation. They are not
required for v0.2 acceptance and must not displace P0 work. Each P2 item should
be implemented only when its behavior, migration impact, and user-interface
cost are understood.

When priorities conflict, preserve data integrity, local-first behavior,
privacy, and a small product surface before adding convenience features.

## 4. P0 Backlog

### Permanent Delete for Archived Items Only

- Allow permanent deletion only when an item has status `archived`.
- Require clear confirmation before deletion.
- Do not add bulk deletion in this scope.
- Ensure deleting one item does not modify other items or settings.
- Keep archive as the required safeguard before irreversible deletion.

### Edit Category, Owner, and Due Date

- Add item editing for `category`, `owner`, and `dueDate`.
- Preserve existing values when unrelated fields are edited.
- Support clearing optional values.
- Validate due-date input before saving.
- Keep editing compatible with existing valid v0.1 stored items.

### Category Filter

- Add a category filter alongside the existing status and priority filters.
- Derive available category values from locally stored items.
- Provide an understandable option for uncategorized items.
- Preserve clear filtered-empty behavior.
- Keep combined filters predictable.

### Due Date Basics

- Make overdue and due-soon items visibly distinguishable, filterable, or both.
- Define overdue using the user's local date and incomplete item states.
- Use a small, documented due-soon window.
- Avoid reminders, notifications, recurrence, calendar views, and calendar
  integration in v0.2.
- Handle missing or invalid due dates without breaking the item list.

### Report and Template Language Wiring

- Apply `defaultReportLanguage` to generated reports and message templates.
- Define and document the supported language values.
- Preserve current output behavior as a fallback for missing or invalid
  settings.
- Keep generation fully local and deterministic.
- Do not introduce translation APIs, AI services, or API keys.

## 5. P1 Backlog

### Improve Report and Template Formatting

- Improve headings, spacing, grouping, and field labels.
- Keep output concise and ready to paste into common workplace tools.
- Ensure formatting remains readable in every supported report language.

### Import Mode: Replace vs Merge

- Let the user explicitly choose replace or merge before import.
- Preserve replace mode as a clearly explained option.
- Define deterministic duplicate handling for merge mode.
- Validate the complete backup before changing local data.
- Keep each confirmed import logically atomic at the storage-operation level.

### Basic Icon and Branding

- Add a consistent extension icon set and minimal visual identity.
- Keep branding lightweight and suitable for an early local-first product.
- Avoid a broad visual redesign.

### Save-State Polish

- Show clear saving, saved, and failed states where edits are persisted.
- Prevent duplicate saves or confusing state changes during rapid edits.
- Preserve user-entered values when a recoverable save error occurs.

### Better Error and Empty States

- Improve messages for no items, no filtered results, load failures, save
  failures, invalid imports, and clipboard failures.
- Give the user a clear recovery action when one is available.
- Avoid exposing captured content or sensitive details in logs.

## 6. P2 Backlog

- Tags editing
- Type editing
- Filtering by tags and type
- CSV export
- Markdown export
- Keyboard shortcuts
- Chrome Web Store preparation checklist

P2 work should remain independently reviewable. Adding one P2 item does not
make the rest part of the v0.2 release commitment.

## 7. Explicitly Out of Scope for v0.2

The following are not part of v0.2:

- AI classification
- AI rewrite
- Cloud sync
- Login or account system
- Team workspace
- Backend API
- Payment or subscription
- Email sending
- Calendar integration
- Analytics tracking
- ERP or 1Office-specific integration

These exclusions are product boundaries, not placeholders to implement during
v0.2 cleanup. Version 0.2 must remain usable without a login, backend, network
service, cloud database, AI provider, or extension-stored API key. T-eraClip
must not expand into an ERP or a generic large task platform.

## 8. Recommended v0.2 Implementation Sequence

1. **v0.2.1 - Delete archived items**
   Add the narrow permanent-delete flow and verify item-level storage safety.
2. **v0.2.2 - Edit category, owner, and due date**
   Complete the next set of core item fields before adding filters based on
   them.
3. **v0.2.3 - Category, status, priority, and due filters**
   Integrate category and due-date behavior with the existing filter model and
   verify combined filtering.
4. **v0.2.4 - Language wiring for reports and templates**
   Connect `defaultReportLanguage` to both generators with a reliable fallback.
5. **v0.2.5 - Output formatting polish**
   Improve generated content after supported languages and fields are stable.
6. **v0.2.6 - Icons and branding polish**
   Apply small visual improvements after the functional v0.2 scope is stable.

P1 or P2 work may be deferred when necessary to protect this sequence. New
feature requests should be recorded for later evaluation rather than inserted
into an active patch without reprioritization.

## 9. Acceptance Criteria for v0.2

Version 0.2 is accepted when:

1. All P0 backlog items are implemented and manually verified.
2. Only archived items can be permanently deleted, deletion requires
   confirmation, and no unrelated local data is changed.
3. Users can edit and clear category, owner, and due date without losing other
   item fields.
4. Category filtering works alone and in combination with status, priority, and
   supported due-date filtering.
5. Overdue and due-soon behavior is clear, uses local dates consistently, and
   does not treat completed or archived items as active overdue work.
6. `defaultReportLanguage` affects both reports and templates, with a safe
   fallback for missing or invalid settings.
7. Existing valid v0.1 data remains readable without requiring a destructive
   migration.
8. Export, import, clear-all, capture, editing, filtering, report generation,
   template generation, and clipboard copy continue to work.
9. Invalid stored items or invalid imports do not corrupt valid local data.
10. No login, backend, cloud sync, AI, analytics, or API key is introduced.
11. Chrome permissions remain limited to those required by implemented local
    features.
12. `npm run typecheck` passes.
13. `npm run build` passes.
14. The v0.2 manual regression checklist has no open P0 defects.
15. Any unfinished P1 or P2 item is documented as deferred and is not presented
    as an existing feature.

## 10. Notes for Future v0.3 and v0.4

### v0.3 - Data Portability and Chrome Web Store Readiness

Potential v0.3 work may focus on mature data portability and distribution:

- Merge-import behavior and duplicate policy, if not completed in v0.2
- CSV and Markdown export
- Backup-version compatibility and migration planning
- Chrome Web Store preparation, packaging, privacy disclosures, screenshots,
  listing content, and release checklist
- Additional automated coverage for storage, import, export, and generators

Chrome Web Store preparation does not imply adding accounts, cloud sync, or
analytics.

### v0.4 - Optional AI Architecture

AI should be considered only as a separately approved, optional product layer.
Any v0.4 AI design must:

- Use a backend proxy rather than storing provider API keys in the extension.
- Require explicit user consent before sending item content.
- Explain what data is sent, why it is sent, and how it is handled.
- Preserve useful local-only behavior when AI is disabled or unavailable.
- Keep AI classification or rewriting optional and user-initiated.
- Receive separate privacy, security, cost, and scope review before
  implementation.

AI is not part of v0.2 and should not influence v0.2 architecture beyond
avoiding decisions that unnecessarily prevent a future optional integration.
