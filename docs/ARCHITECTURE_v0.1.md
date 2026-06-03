# T-eraClip Architecture v0.1

## 1. Technical Goal

Build a local-first Chrome Extension using Manifest V3.

Version 0.1 should work without login, backend, cloud sync, or AI API.

## 2. Recommended Stack

- Chrome Extension Manifest V3
- React
- Vite
- TypeScript
- Tailwind CSS
- Chrome Storage API
- Chrome Context Menus API
- Chrome Runtime Messaging
- Content Scripts
- Clipboard API

## 3. Extension Parts

### 3.1 Manifest

File:

- manifest.json

Responsibilities:

- Define extension name
- Define permissions
- Register background service worker
- Register content scripts
- Register popup page
- Register options page

### 3.2 Background Service Worker

File:

- src/background/index.ts

Responsibilities:

- Create context menu
- Handle right-click capture action
- Receive selected text context
- Save captured item to Chrome Storage
- Handle runtime messages if needed

### 3.3 Content Script

File:

- src/content/index.ts

Responsibilities:

- Read selected text if needed
- Provide page context
- Communicate with background script

### 3.4 Popup App

Files:

- src/popup/App.tsx
- src/popup/main.tsx

Responsibilities:

- Show captured items
- Filter items
- Edit item fields
- Mark items done
- Generate reports
- Copy generated text

### 3.5 Options Page

Files:

- src/options/App.tsx
- src/options/main.tsx

Responsibilities:

- Show app settings
- Set default report language
- Export JSON
- Import JSON
- Clear all local data

### 3.6 Shared Types

File:

- src/shared/types.ts

Responsibilities:

- Define item data model
- Define status values
- Define priority values
- Define item type values

### 3.7 Storage Service

File:

- src/shared/storage.ts

Responsibilities:

- Get all items
- Add item
- Update item
- Delete or archive item
- Export data
- Import data
- Clear data

### 3.8 Report Service

File:

- src/shared/reportGenerator.ts

Responsibilities:

- Generate daily report
- Generate follow-up list
- Generate waiting-for-response list
- Generate completed items list
- Generate templates

## 4. Data Model

```ts
export type TeraClipItemType =
  | "task"
  | "checklist"
  | "followup"
  | "note"
  | "report_input";

export type TeraClipStatus =
  | "inbox"
  | "todo"
  | "doing"
  | "waiting"
  | "done"
  | "archived";

export type TeraClipPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent";

export interface TeraClipItem {
  id: string;
  type: TeraClipItemType;
  title: string;
  originalText: string;
  sourceUrl: string;
  sourceTitle: string;
  createdAt: string;
  updatedAt: string;
  status: TeraClipStatus;
  priority: TeraClipPriority;
  owner: string;
  dueDate: string;
  category: string;
  tags: string[];
  notes: string;
}