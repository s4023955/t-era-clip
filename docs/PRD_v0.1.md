# T-eraClip PRD v0.1

## 1. Product Name

T-eraClip

## 2. Tagline

Clip anything. Turn it into action.

## 3. Product Summary

T-eraClip is a Chrome Extension that helps users capture selected web content and turn it into structured work items.

Users can select text on any webpage, right-click, save it to T-eraClip, then manage the captured items from the extension popup.

The product focuses on converting scattered web information into actionable items such as tasks, checklist items, follow-ups, notes, and report inputs.

## 4. Target User

Initial target user:

- Office workers
- Project managers
- Operations staff
- Vendor coordinators
- Admin teams
- Team leads who collect information from web-based systems, emails, dashboards, or internal tools

## 5. Core Problem

Users often read useful information on websites or internal tools, but they lose time manually copying it into notes, tasks, reports, or follow-up messages.

This creates problems:

- Important information is scattered
- Follow-ups are missed
- Reports take time to prepare
- Source context is lost
- Users repeat manual copy/paste work

## 6. Core Value Proposition

T-eraClip lets users quickly capture selected text from any webpage and turn it into structured work items with source context.

The product helps users:

- Save useful web content quickly
- Track follow-ups and tasks
- Keep source URL and page title
- Generate simple work reports
- Generate copy-ready follow-up messages

## 7. Version 0.1 Goal

The goal of version 0.1 is to prove the basic workflow:

1. Select text on a webpage
2. Right-click and save it to T-eraClip
3. Store the captured item locally
4. View and edit captured items in popup
5. Generate simple reports and follow-up messages

## 8. Non-Goals for v0.1

Version 0.1 will not include:

- User login
- Cloud sync
- Team workspace
- Role permissions
- Backend server
- AI API integration
- Payment system
- Real-time collaboration
- Mobile app
- Advanced analytics
- Marketplace integration
- ERP integration
- 1Office-specific dependency

## 9. Main User Flow

### Capture Flow

1. User opens any webpage
2. User selects text
3. User right-clicks selected text
4. User clicks "Save to T-eraClip"
5. Extension saves selected text with source URL, page title, and timestamp
6. User sees the item in the extension popup

### Manage Flow

1. User opens extension popup
2. User sees list of captured items
3. User edits title, status, priority, due date, owner, category, notes
4. User marks items as done or archived

### Generate Output Flow

1. User opens report/template section
2. User selects output type
3. Extension generates copy-ready text
4. User copies the output to clipboard

## 10. MVP Features

### Required Features

- Chrome Extension Manifest V3
- Right-click capture selected text
- Local storage using Chrome Storage API
- Popup item list
- Edit item metadata
- Mark item status
- Filter by status and category
- Generate daily report
- Generate follow-up list
- Generate waiting-for-response list
- Generate completed items list
- Generate vendor follow-up template
- Generate internal follow-up template
- Generate leadership summary template
- Generate meeting action list template
- Options page with export/import JSON and clear data

## 11. Data Fields

Each captured item should include:

- id
- type
- title
- originalText
- sourceUrl
- sourceTitle
- createdAt
- updatedAt
- status
- priority
- owner
- dueDate
- category
- tags
- notes

## 12. Success Criteria for v0.1

Version 0.1 is successful if:

- User can install the extension as unpacked extension in Chrome
- User can select text and save it through right-click menu
- Captured item appears in popup
- Item source URL and page title are saved correctly
- User can edit item fields
- User can mark item done
- User can generate and copy a simple report
- User can export and import local JSON data
- No login or backend is required