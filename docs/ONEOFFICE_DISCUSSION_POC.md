# T-eraClip 1Office Discussion Export PoC

## 1. Status And Purpose

This document defines a separate proof of concept for exporting 1Office
discussion data from the project or task page currently open in Chrome.

The PoC is not part of the T-eraClip v0.2 commitment. The existing v0.2 backlog
continues to exclude ERP and 1Office-specific integration. This workstream must
be evaluated independently before it is added to a product release.

The primary product objective is speed and convenience:

> A signed-in user opens a supported 1Office project or task, clicks Export,
> reviews the collected discussion, and downloads the selected output without
> manually expanding older comments.

## 2. Confirmed Environment

- Browser: Chrome 154.0.8037.58
- Operating system: macOS Sequoia 15.5
- Allowed origin: `https://office.meygroup.vn/`
- The user must already be authenticated in the active browser tab.
- Discussion content is available in the regular page DOM.
- No relevant iframe or Shadow DOM boundary was found in the collected samples.
- The extension must not read, export, or persist passwords, cookies, access
  tokens, session identifiers, or authorization headers.

Authentication is owned by 1Office. T-eraClip operates only on DOM content and
user-visible controls available to the signed-in user.

## 3. Confirmed DOM Findings

### 3.1 Supported Entity Contexts

The discussion root contains a `comments-id` value that identifies both the
entity type and the internal object ID:

```text
work-project-project@830
work-task-task@91637
```

The PoC recognizes:

```text
work-project-project@<id> -> project
work-task-task@<id>       -> task
```

The business code and display name are separate from this internal ID. Task
metadata is presented as label and value pairs, including `Ma cong viec` and
`Ten cong viec` in the Vietnamese interface.

### 3.2 Comments And Replies

Confirmed DOM patterns:

```text
.cards.comments[comments-id]
.cards-body > .comment
.comment.comment<ID>
.comment-head > a.userlink
.comment-post
.comment-panel-time span[title]
.cards.sub-comments[comments-id="c<PARENT_ID>"]
```

Observed examples confirm:

- Root comment IDs are available in a class such as `comment9398`.
- Replies are nested under the root comment's `.sub-comments` container.
- The sub-comment container references its parent with `comments-id="c9398"`.
- Author name is available as visible link text.
- Author ID is available from the profile URL and avatar `uid` attribute.
- The visible time may be relative, but an absolute local timestamp is
  available in the time element's `title` attribute.
- Mentions may be represented as `a.userlink` elements inside `.comment-post`.
- Comment content may contain nested block elements, links, line breaks, and
  non-breaking spaces.

The parser must not use visual indentation to determine parent-child
relationships when the structural relationship is available.

### 3.3 Loading Older Comments

The confirmed load-more control is:

```html
<div class="prev">
  <a class="bt">Xem them 10/17 thao luan cu hon</a>
</div>
```

The count text is useful for progress feedback but must not be the only stop
condition. The control may change language or wording.

### 3.4 Attachments

Attachment cards provide visible metadata through `.comment-file.quickview`,
including a display name, size, and thumbnail.

The 1Office document viewer renders PDF pages into canvas elements. The
collected viewer DOM does not expose a PDF URL, blob URL, iframe source, object
data URL, or embed source.

The official download control is identifiable as:

```html
<a rel="download" title="Tai xuong" class="bt">
```

It has no `href` in the rendered DOM. Download behavior is controlled by
1Office JavaScript and the current authenticated session.

## 4. PoC Scope

### 4.1 In Scope

- Operate on the project or task currently open in the active tab.
- Require an explicit user action to begin collection.
- Validate that the active page belongs to the approved 1Office origin.
- Detect whether the current entity is a project or task.
- Read the internal ID, business code when available, display name, and URL.
- Automatically activate the older-comment control until all available root
  comments are loaded or a guarded failure occurs.
- Parse root comments and replies from the rendered DOM.
- Preserve source order and parent-child relationships.
- Extract author, timestamp, content, mentions, and attachment metadata.
- Show a review screen before export.
- Export validated JSON first.
- Add XLSX only after JSON collection is verified.
- Defer DOCX until after go-live.
- Offer a separate, experimental action that invokes the official 1Office
  attachment download control.
- Keep all parsing and output generation local to the browser.

### 4.2 Out Of Scope

- Scanning every task in a project automatically during Gates 1 through 5.
- Navigating through multiple tasks without user review.
- Calling undocumented 1Office endpoints.
- Reading or storing browser credentials.
- Bundling original attachment bytes into a ZIP during the first PoC.
- Writing comments or changes back to 1Office.
- AI classification, summarization, or rewriting.
- Backend storage, cloud synchronization, or team workspaces.
- Replacing the existing generic T-eraClip capture workflow.

## 5. Target User Flow

1. The user signs in to 1Office normally.
2. The user opens one project or task detail view.
3. The user opens T-eraClip.
4. T-eraClip shows `Export 1Office discussion` only for a supported page.
5. The user starts collection.
6. T-eraClip displays progress while older comments are loaded.
7. T-eraClip parses the discussion and reports any completeness warning.
8. A dedicated review page shows entity details, counts, hierarchy, attachment
   metadata, and warnings.
9. The user chooses JSON or XLSX.
10. The user confirms export.
11. Attachment downloads, when requested, run as a separate action through the
    official 1Office viewer controls.

The extension popup is not the final review surface. Long discussions require
a dedicated extension page or side panel that remains open during review.

## 6. Proposed Data Model

```ts
type OneOfficeEntityType = 'project' | 'task';

interface OneOfficeEntityContext {
  type: OneOfficeEntityType;
  internalId: string;
  code: string | null;
  name: string;
  url: string;
}

interface OneOfficeAttachment {
  index: number;
  name: string;
  sizeText: string | null;
  thumbnailUrl: string | null;
  originalDownloadAvailable: boolean;
}

interface OneOfficeMention {
  userId: string | null;
  displayName: string;
}

interface OneOfficeComment {
  id: string;
  parentId: string | null;
  rootId: string;
  depth: number;
  sourceOrder: number;
  authorId: string | null;
  authorName: string;
  createdAtRaw: string;
  createdAtIso: string | null;
  contentText: string;
  mentions: OneOfficeMention[];
  attachments: OneOfficeAttachment[];
}

interface OneOfficeCollectionStatus {
  complete: boolean;
  loadMoreClicks: number;
  loadedRootCommentCount: number;
  loadedReplyCount: number;
  expectedRootCommentCount: number | null;
  warnings: string[];
}

interface OneOfficeDiscussionExport {
  schemaVersion: 1;
  source: '1office-dom';
  capturedAt: string;
  entity: OneOfficeEntityContext;
  collection: OneOfficeCollectionStatus;
  comments: OneOfficeComment[];
}
```

Discussion captures must remain separate from the existing `TeraClipItem`
model. A future workflow may create a TeraClip item from a confirmed comment,
but the source discussion and the derived work item are different records.

## 7. Parser Rules

### 7.1 Entity Detection

- Find `.cards.comments[comments-id]` inside the active discussion tab.
- Parse only the confirmed project and task prefixes.
- Reject an unknown prefix with a clear unsupported-page message.
- Use the internal ID from `comments-id`, not from user-visible text.
- Locate business code and name by normalized field label, not by screen
  position.

### 7.2 Comment Identity

- Prefer the numeric ID from the `comment<ID>` class.
- Use `comments-id="c<ID>"` to connect a sub-comment container to its parent.
- Treat the other DOM `id` as diagnostic data, not the primary business key,
  until stability across reloads is verified.
- Do not use a synthetic hash when a confirmed numeric ID exists.

### 7.3 Content Extraction

- Clone `.comment-post` before normalization.
- Extract mentions from user links inside the clone.
- Remove `.comment-files` before reading comment text.
- Convert block boundaries and `<br>` elements into sensible line breaks.
- Normalize non-breaking spaces without collapsing intentional paragraphs.
- Do not include controls, reaction labels, reply forms, or attachment captions
  in `contentText`.

### 7.4 Timestamp Handling

- Preserve the original absolute timestamp from the `title` attribute.
- Parse the confirmed `HH:mm:ss dd/MM/yyyy` format using the local 1Office
  timezone assumption.
- Store `createdAtIso` only when parsing succeeds.
- Preserve `createdAtRaw` and add a warning when parsing fails.
- Do not derive the timestamp from relative text such as `vua xong`.

### 7.5 Load-More Loop

For each iteration:

1. Count current root comments.
2. Locate the visible older-comment control.
3. If it does not exist, collection is complete.
4. Activate the control.
5. Observe the root comment container until its count increases or loading
   settles.
6. Record the new count and update progress.
7. Stop with an incomplete warning after a configured no-progress timeout or
   iteration safeguard.

The collector must never loop indefinitely. A partial export is allowed only
after the review screen clearly identifies that collection is incomplete.

### 7.6 Ordering

- Preserve DOM order as `sourceOrder`.
- Do not silently assume ascending or descending chronology.
- Exporters may provide an explicit chronological view after timestamps have
  been validated, while retaining source order in JSON.

## 8. Extension Architecture

### 8.1 Permissions

Initial permission target:

```json
{
  "permissions": ["storage", "contextMenus", "activeTab", "scripting"]
}
```

- Do not add `<all_urls>`.
- Do not add persistent host permissions for the first PoC.
- Validate the exact approved origin at runtime before injection.
- Add another permission only when an implemented capability demonstrably
  requires it.

### 8.2 Components

```text
Popup command
  -> active-tab validation
  -> on-demand collector injection
  -> entity detection
  -> guarded load-more loop
  -> DOM parser
  -> normalized capture result
  -> review page
  -> JSON/XLSX exporter
```

Suggested source ownership:

```text
src/oneoffice/types.ts
src/oneoffice/selectors.ts
src/oneoffice/parser.ts
src/oneoffice/collector.ts
src/oneoffice/timestamp.ts
src/oneoffice/export/json.ts
src/oneoffice/review/
```

The parser should be a pure module that accepts a DOM root. Browser interaction
and load-more behavior belong in the collector. This separation allows fixture
tests without a live 1Office account.

## 9. Export Behavior

### 9.1 JSON

JSON is the first required output because it preserves the full normalized
schema and is suitable for parser verification.

### 9.2 XLSX

The business-oriented workbook should include at least:

- `Discussion` sheet with one row per comment or reply
- `Entity` sheet with project or task metadata
- `Attachments` sheet with one row per attachment
- Parent ID, depth, and an indented display-text column

### 9.3 DOCX

DOCX export is deferred until after go-live. It is not part of the PoC delivery
gates because JSON preserves the normalized source data and XLSX covers the
current business review and handoff workflow.

### 9.4 Attachments

- Metadata is part of JSON and XLSX.
- Original attachment download is a separate user-confirmed action.
- The first PoC may automate the official viewer download button.
- The PoC must report when Chrome blocks or asks permission for multiple
  downloads.
- Original files are not included in a ZIP until a supported and auditable way
  to obtain file bytes is established.

## 10. Delivery Sequence And Gates

### Gate 1 - Pure Parser

- Add sanitized project, populated-task, and empty-task HTML fixtures.
- Parse entity context, root comments, replies, authors, timestamps, content,
  mentions, and attachment metadata.
- Verify exact expected counts and relationships.
- No browser injection in this gate.

Status on 2026-09-28: complete.

- Sanitized fixtures and focused parser tests are in the repository.
- The parser was checked against the supplied local HTML samples without
  committing those samples or their internal data.
- The supplied project discussion sample produced 27 root comments and 5
  replies. The populated task produced 1 root comment and 1 reply. The empty
  task produced 0 comments.
- The project discussion sample did not include project name or project code
  markup. Missing metadata is therefore reported as a warning, not inferred.
- At Gate 1 completion, manifest permissions, live-page injection, export UI,
  and file generation remained unchanged.

### Gate 2 - On-Demand Collection

- Add `scripting` permission.
- Validate the active origin.
- Inject only after an explicit user action.
- Automate load-more with progress, timeout, and safeguards.
- Return a normalized result without persisting it automatically.

Status on 2026-09-28: complete.

- Added only the `scripting` permission. No persistent host permission or
  `<all_urls>` access was added.
- The popup exposes collection only when the active tab matches the exact
  approved HTTPS origin.
- Injection occurs only after the user selects `Collect discussion`.
- The collector reports progress and stops after 5 seconds without progress or
  100 load-more activations.
- Returned HTML is limited to the selected visible discussion and visible
  entity name/code fields. Forms, inputs, reply controls, reaction controls,
  and editable content are removed from the returned snapshot.
- The normalized result remains in popup memory and is not saved or downloaded.
- Automated collector and parser tests pass. A read-only inspection of the
  supplied live test page confirmed 27 visible project root comments and that a
  hidden task discussion is excluded.
- End-to-end execution through the reloaded Chrome extension passed on the
  supplied project page: 27 root comments, 5 replies, 1 attachment, and a
  complete status were reported without saving or downloading data.
- A later live load-more run exposed duplicate DOM nodes from 1Office: 33 root
  nodes represented 27 unique comment IDs. Root progress and normalized output
  now deduplicate by confirmed comment ID, with focused regression tests.
- The same run showed that 1Office can remove the load-more control before the
  final comment node arrives. The collector now waits for the expected unique
  root count and a 750 ms stable period. It reports incomplete after the 5
  second timeout instead of treating a short count as complete.
- Live inspection after a clean reload confirmed 10 initially loaded unique
  roots and the label `Xem thêm 10/17`, establishing an expected total of 27.
  The collector now locks this first expected total instead of recalculating it
  from later labels after duplicate nodes have been inserted.
- A clean live rerun returned 27 unique roots, 5 replies, 1 attachment, and a
  complete status on the first collection attempt. Duplicate-node diagnostics
  remain in the normalized result but are hidden from the normal popup because
  they are handled automatically and require no user action.
- Live validation of the populated `TEST_SUB` task returned 1 root, 1 reply, 0
  attachments, and a complete status.
- Live validation of the empty `Test` task returned 0 roots, 0 replies, 0
  attachments, and a complete status.

### Gate 3 - Review And JSON

- Add the dedicated review surface.
- Show completeness, warning, root, reply, and attachment counts.
- Require confirmation before writing the JSON download.

Status on 2026-09-28: complete.

- `Review and export JSON` copies the normalized result to
  `chrome.storage.session` only after an explicit user action and opens a
  dedicated extension page.
- Temporary review data remains separate from `TeraClipItem` local storage and
  is cleared when the browser session ends.
- The review page validates the stored schema before rendering it.
- The page shows entity metadata, completeness, counts, actionable warnings,
  diagnostics, source order, reply hierarchy, mentions in content, and
  attachment metadata.
- JSON download requires a confirmation dialog. Incomplete collections also
  require a separate acknowledgement checkbox.
- JSON contains metadata only for attachments. It does not download or embed
  original attachment files.
- Filename generation and JSON round-trip behavior have focused automated
  tests.
- Live project validation confirmed that the Preview opens and downloads JSON.
  The downloaded file parsed successfully with schema version 1, 27 roots, 5
  replies, 32 unique comment IDs, valid parent references, 1 attachment
  metadata record, and no binary or base64 attachment fields.

### Gate 4 - XLSX

- Add XLSX export from the reviewed normalized result.
- Include `Entity`, `Discussion`, and `Attachments` sheets.
- Preserve source order and reply relationships in flat, filter-ready rows.
- Require confirmation before writing the XLSX download.
- Verify structure and readability against the same normalized result.
- Keep export-library size and permission impact visible in review.

DOCX is explicitly deferred until after go-live and is not required to pass
Gate 4.

Status on 2026-09-28: complete.

- The review page presents Excel as the primary export and keeps JSON as the
  normalized technical export.
- XLSX download requires the same confirmation and incomplete-collection
  acknowledgement as JSON.
- The workbook contains `Entity`, `Discussion`, and `Attachments` sheets with
  frozen headers, readable widths, source order, reply IDs, mentions, and
  attachment metadata.
- Original attachment files are not embedded in the workbook.
- XLSX generation adds no Chrome permission and runs locally in the review
  page.
- Production dependency audit reports zero known vulnerabilities. Existing
  audit findings are limited to development tooling and are not bundled into
  the extension.
- Focused tests verify workbook rows, sheet names, ZIP structure, and that
  formula-like comment text remains text rather than an executable formula.
- Automated tests, typecheck, and production build pass.
- Live Chrome validation downloaded
  `tera-clip-oneoffice-project-test-2026-09-28.xlsx`. The archive integrity
  check passed and Microsoft Excel opened it without a repair warning.
- Excel confirmed three sheets and their used ranges: `Entity` (`A1:B15`),
  `Discussion` (`A1:R33`), and `Attachments` (`A1:M2`). The live workbook
  preserved the entity name, complete status, 32 discussion entries, a reply
  with its parent comment ID, and the collected attachment metadata.

### Gate 5 - Attachment Download Experiment

- Open one test attachment through the existing page control.
- Activate the official download control.
- Test one and multiple attachments.
- Document Chrome prompts, failure states, and user interruption behavior.
- Do not block the core discussion export on this experimental gate.

Status on 2026-09-28: evaluated, not accepted for release.

- Manual feasibility was confirmed on the signed-in project sample. Opening
  the attachment card and activating 1Office's visible `Tải xuống` control
  downloaded a valid two-page PDF.
- The downloaded file was produced by 1Office's existing viewer control. The
  experiment did not read cookies, authentication tokens, or a hidden download
  API.
- Automated control from the extension did not pass live validation. The
  1Office viewer opened and downloaded correctly from a real user click, but it
  did not reliably expose the download control after a script-generated
  attachment-card activation. Running in the page execution world and bringing
  the source tab to the foreground did not resolve the failure.
- The sample contains one unique attachment. Multiple distinct attachments and
  Chrome's multiple-download permission prompt therefore could not be verified
  live.
- The experimental download button and its automation code were removed after
  the failed live validation. The release UI does not imply that original-file
  download is supported.
- Attachment metadata remains available in Review, JSON, and Excel. Original
  file download remains a separate future decision and does not block the
  verified discussion export flow.

No later gate starts until the current gate has passed its focused tests.

## 11. Acceptance Criteria For The PoC

The PoC is successful when:

1. A user can initiate collection from a supported project or task page.
2. Unsupported pages are rejected without injecting the collector.
3. Older comments are loaded automatically until complete or clearly reported
   incomplete.
4. The project sample parses 27 root comments and 5 replies.
5. The populated task sample parses one root comment and one reply.
6. The empty task sample returns zero comments without error.
7. Parent IDs are correct for every parsed reply.
8. Absolute timestamps are used instead of relative display text.
9. Mentions are separated from author identity.
10. Comment text excludes controls and attachment captions.
11. Attachment name and size metadata are preserved.
12. No data is exported before review and confirmation.
13. JSON output passes schema validation.
14. XLSX contains entity metadata, one row per discussion entry, reply
    relationships, mentions, and attachment metadata.
15. Collection does not read or persist credentials.
16. The existing generic right-click capture continues to work.
17. `npm run typecheck` passes.
18. `npm run build` passes.

## 12. Known Risks And Decisions

- 1Office may change selectors without notice. Centralize selectors and include
  parser-version diagnostics.
- Numeric comment IDs appear structurally reliable but still require a reload
  stability test during live validation.
- The task detail view may be rendered inside an application modal while still
  sharing the top-level page DOM. Entity detection must use the active visible
  discussion root when more than one matching root exists.
- Multiple download automation may trigger a Chrome permission prompt.
- Attachment bytes are not exposed in the confirmed DOM.
- Large discussions may exceed a comfortable popup lifecycle. Collection and
  review must not depend on the popup remaining open.
- The collected fixture source may contain internal names or IDs. Only
  sanitized fixtures may be committed to the repository.

## 13. Current Implementation Boundary

Gate 1, Gate 2, Gate 3, and Gate 4 are complete. Gate 4 is limited to XLSX
export. DOCX export is deferred until after go-live. Gate 5 has been evaluated
but did not pass live automation validation, so original attachment downloads
remain outside the current implementation boundary. No broader phase starts
until the user provides the next product direction.

## 14. Phase 6 - Project-Wide Discussion Export

The approved next direction is to export discussions for every task in a
project, including parent tasks and nested child tasks. Original attachment
file downloads remain outside this phase.

### Phase 6.1 - Project Task Inventory

Implementation status on 2026-09-28: full-inventory fix implemented and
automatically verified, awaiting a live rerun on the 414-task project.

- Add a separate inventory action without changing current-page discussion
  collection.
- Load the complete task structure from the authenticated project Gantt data
  endpoint instead of treating the virtualized task rows as the full project.
- Read each task's internal ID, parent ID, phase, business code, display name,
  and URL from the complete structure response.
- Load detailed fields in bounded batches of 50 tasks. The configured `No.`
  field is returned through `cf19`; the Gantt outline is used only when that
  field is blank.
- Treat `No.` as the user-facing hierarchy value. Some confirmed 1Office DOM
  layouts expose the same value through the hidden `Thu tu` column, so the
  collector accepts that value as a fallback.
- Preserve `No.` as text, including values such as `1.10`.
- Support arbitrary nesting depth rather than hard-coding two levels.
- Reproduce the Gantt phase/tree traversal to derive the outline at arbitrary
  nesting depth, while resolving `parentNo` and `parentInternalId` from the
  actual parent relationship.
- Compare collected task count with the project tab count when available.
- Keep the rendered-DOM collector only as a fallback for non-virtualized tables.
  Do not start project collection when the Gantt request fails and the DOM
  contains fewer tasks than the project counter.
- Report missing or duplicate `No.` values and incomplete task counts.
- Do not collect project-wide comments or export a project-wide workbook yet.

Focused automated coverage includes a sanitized six-level task hierarchy,
parent resolution, preservation of `1.10`, missing-`No.` warnings, and project
URL validation.

Read-only live DOM validation found three visible task rows with `No.` values
`1`, `1.1`, and `1.1.1`, their separate business codes and names, and correct
derived parent values. The same page still displayed a project tab counter of
two, confirming that a lower stale counter must warn without discarding visible
tasks.

The reloaded popup then confirmed all three tasks, three hierarchy levels, and
the expected `No.`, code, and name values without an inventory warning.

A larger live project later exposed the virtualization boundary: the project
counter showed 414 tasks while only 20 task rows existed in the DOM. Read-only
inspection confirmed that the Gantt structure endpoint returned all 414 tasks
in one response, including parent IDs and hierarchy depths. The Gantt client
then requests detailed fields through `mode=enrich` in batches of up to 50.
Automated coverage now exercises 414 tasks, nine enrichment batches, a
six-level task chain, custom `No.` values, outline fallback, and incomplete
enrichment handling. The extension must still be reloaded and rerun against
that live project before this fix is considered live-validated.

### Phase 6.2 - Sequential Task Discussion Collection

Implementation status on 2026-09-28: automated implementation complete,
awaiting live Chrome validation.

- Keep the popup limited to inventory totals and the explicit start action.
- Open a dedicated full-page collection view for long project task lists.
- Navigate the source project tab through one full task page at a time in
  inventory order, then restore the project page when collection finishes.
- Reuse the verified current-page collector for older comments, root comments,
  replies, mentions, timestamps, and attachment metadata.
- Wait for the rendered discussion DOM to remain unchanged before parsing, and
  compare its unique root/reply counts with the parser result before marking a
  task complete.
- Avoid script-generated quickview clicks. Live validation showed that an
  untrusted background click can navigate directly to the quickview JSON
  endpoint and remove the source frame.
- Continue after a task failure and retain the error against that task.
- Show overall progress, per-task status, root-comment totals, reply totals,
  and a stop-after-current-task action.
- Keep results in the collection page memory for this validation phase. Closing
  or refreshing that page discards the collected batch.
- Do not enable project-wide XLSX or JSON download until live collection counts
  have been checked against the three-task test project.

The first full-page live run reached all three tasks but incorrectly reported
zero comments for every task, including the populated `TEST_SUB` task. The
readiness check had accepted the discussion container before its asynchronous
comment content was stable. The collector now requires a stable discussion
signature and rejects a parser/DOM count mismatch instead of reporting a false
successful zero. Automated coverage confirms the expected `1 root + 1 reply`
DOM count, but the corrected batch result still requires a live rerun.

The source project tab must stay open. The batch page does not read cookies,
tokens, hidden APIs, or attachment bytes, and it does not create one browser tab
per task.

### Phase 6.3A - Authenticated Quickview Probe

Implementation status on 2026-09-28: automated and live Chrome validation
complete. The temporary probe table was removed after validation.

- After the verified full-page batch finishes, probe up to three tasks through
  the same-origin quickview content URL using the user's existing 1Office
  session.
- Compare quickview root/reply counts with the verified full-page baseline.
- Display `Match`, `Mismatch`, `Needs fallback`, or `Unavailable` for each
  probed task.
- Do not use probe output for JSON, XLSX, or project totals.
- Do not enable concurrent project collection until the populated and empty
  test tasks match their full-page baselines.
- Keep full-page navigation as the fallback for load-more discussions and any
  unsupported quickview response.

This gate exists because the task inventory does not expose a reliable
discussion count. Empty tasks therefore cannot be skipped safely from the
project table alone. The probe tests whether 1Office's authenticated quickview
response can remove full-page navigation without reintroducing false zero
results.

### Phase 6.3B - Bounded Fast Collection

Implementation status on 2026-09-28: automated implementation complete,
awaiting live Chrome validation.

- Use the validated authenticated quickview response as the primary collection
  path.
- Run quickview collection in groups of three tasks to reduce wall-clock time
  without sending an unbounded request burst to 1Office.
- Accept a fast result only when the expected task ID and parser counts match
  the inspected response.
- Fall back to the verified full-page collector when quickview is unavailable,
  contains a load-more control, or fails validation.
- Keep the source project page in place when every task succeeds through the
  fast path. Restore it only after a fallback task required navigation.
- Remove diagnostic fast-path details from the user-facing results page.

The concurrency value is intentionally conservative. It can be reconsidered
only after testing on a larger project and checking for 1Office throttling,
timeouts, and incomplete responses.

### Phase 6.3C - Direct Comment Endpoint

Implementation status on 2026-09-28: automated implementation complete,
awaiting live Chrome validation.

Live resource inspection confirmed that 1Office loads discussion data from:

```text
/comment/post/gets?object=work-task-task&object_id=<TASK_ID>
```

The response provides root items, nested replies, root and reply totals,
authors, absolute timestamps, content, and attachment metadata without loading
the full task quickview. A read-only request for the populated test task
returned its `1 root + 1 reply` response in about 0.4 seconds during inspection.
That observation is not yet a production performance guarantee.

Project collection now uses three guarded levels:

1. Direct comment endpoint, requested in groups of three tasks.
2. Authenticated quickview when the endpoint response is unavailable or fails
   validation.
3. Full-page collection for load-more or other unresolved cases.

The endpoint result is accepted only when the returned root count equals
`total`, each nested reply count equals `total_subs`, comment IDs are unique,
and the response can be normalized into the existing export model. Otherwise,
the collector falls back instead of exporting a partial result.

### Phase 6.4 - Project-Wide Excel Export

Implementation status on 2026-09-28: automated implementation complete,
awaiting live Chrome download validation.

- Enable Excel export only after the project collection finishes.
- Show the filename and workbook scope in a confirmation dialog before
  download.
- Require explicit acknowledgement when any task is incomplete, failed, or
  cancelled.
- Generate four sheets:
  - `Project`: project identity, collection summary, totals, and warnings.
  - `Tasks`: every task with `No.`, hierarchy, internal ID, business code,
    name, collection status, discussion totals, and errors.
  - `Discussion`: one row per root comment or reply, linked to project and task
    identity with parent/root IDs, parent content, author, time, content,
    mentions, and attachment summary.
  - `Attachments`: one row per attachment metadata item linked to its task and
    comment.
- Preserve task `No.` values such as `1.10` as text.
- Store IDs, codes, names, discussion text, and other user-controlled strings
  as text cells so formula-like values are not executed by Excel.
- Do not include original attachment bytes and do not add DOCX export.
