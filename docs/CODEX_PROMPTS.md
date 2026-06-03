# T-eraClip Codex Prompts

This file stores implementation prompts for Codex.

## Prompt Rules

Every prompt sent to Codex must include:

- Clear goal
- Current project state
- Exact implementation requirements
- Files to create or modify
- Constraints
- Acceptance criteria
- Manual test steps
- Expected output from Codex

Codex must not add unrequested features.

Codex must not over-engineer.

Codex must explain file changes after implementation.

Codex must include manual test steps.

---

## Prompt Template

Title:

Goal:

Context:

Current State:

Implementation Requirements:

Files to Create/Modify:

Constraints:

Acceptance Criteria:

Manual Test Steps:

Expected Output from Codex:

---

## Phase 4 Prompt — Project Scaffolding

Title:
Set up T-eraClip Chrome Extension project scaffold

Goal:
Create the base project structure for a Chrome Extension using React, Vite, TypeScript, and Tailwind CSS.

Context:
T-eraClip is a Chrome Extension that lets users select text on any webpage, save it as a structured work item, manage items in a popup, and generate simple reports.

Current State:
The repository currently has a docs folder with PRD, MVP scope, architecture, and Codex prompt documentation. No application code has been created yet.

Implementation Requirements:
1. Initialize a Vite React TypeScript project.
2. Add Tailwind CSS.
3. Prepare folder structure for:
   - background script
   - content script
   - popup app
   - options app
   - shared types
   - shared storage service
   - shared report generator
4. Add basic build scripts.
5. Do not implement full business logic yet.
6. Do not add login, backend, cloud sync, or AI.

Files to Create/Modify:
- package.json
- index.html or Vite entry files as needed
- vite.config.ts
- tsconfig.json
- tailwind.config.js
- postcss.config.js
- src/background/index.ts
- src/content/index.ts
- src/popup/App.tsx
- src/popup/main.tsx
- src/options/App.tsx
- src/options/main.tsx
- src/shared/types.ts
- src/shared/storage.ts
- src/shared/reportGenerator.ts

Constraints:
- Use Manifest V3 architecture.
- Use TypeScript.
- Keep implementation minimal.
- Do not add unrequested dependencies.
- Do not add backend.
- Do not add AI.
- Do not add authentication.

Acceptance Criteria:
1. Project installs dependencies successfully.
2. Project builds successfully.
3. Folder structure matches the architecture document.
4. Popup and options entry points exist.
5. No secrets or API keys are added.
6. No unrequested features are added.

Manual Test Steps:
1. Run npm install.
2. Run npm run build.
3. Confirm dist folder is generated.
4. Confirm no TypeScript errors.
5. Confirm no unnecessary features were added.

Expected Output from Codex:
- Implement the scaffold.
- Explain every created or modified file.
- Provide the commands to run.
- Provide manual test steps.

## 5. Storage Design

Use Chrome Storage API: chrome.storage.local
Storage key: teraClipItems
Setting key: teraClipSettings
Initial setting: 
{
  defaultReportLanguage: "vi"
}


## 6. Capture Flow

1. Background script creates context menu on extension install.
2. User selects text on webpage.
3. User right-clicks and chooses “Save to T-eraClip”.
4. Background receives context menu click event.
5. Background creates a new TeraClipItem.
6. Item is saved to chrome.storage.local.
7. User opens popup and sees the item.

## 7. Popup Flow

1. Popup loads items from chrome.storage.local.
2. Popup displays item list.
3. User edits fields.
4. Updated item is saved back to chrome.storage.local.
5. User generates report or template.
6. Popup copies output using Clipboard API.

## 8. Options Flow

1. Options page loads settings and data.
2. User can export JSON.
3. User can import JSON.
4. User can clear all local data.

## 9. Manifest Permission
Required permission: 
[
  "storage",
  "contextMenus",
  "activeTab",
  "scripting"
]

Recommend host permission: 
[
  "<all_urls>"
]

## 10. Security Rules

* Do not store API keys in the extension.
* Do not send captured data to external servers in v0.1.
* Do not require login.
* Do not add backend in v0.1.
* All data stays in local browser storage.
* User must be able to clear local data.

## 11. Manual Testing Requirement

Every feature must be tested manually in Chrome as an unpacked extension.

Required manual tests:

1. Load unpacked extension.
2. Select text on a normal webpage.
3. Save selected text using context menu.
4. Open popup and verify item appears.
5. Verify source URL and title.
6. Edit item fields.
7. Change status.
8. Generate report.
9. Copy report.
10. Open options page.
11. Export JSON.
12. Import JSON.
13. Clear all data.
