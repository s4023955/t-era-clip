# T-eraClip MVP Scope v0.1

## 1. Scope Principle

Version 0.1 must stay small.

The product must first prove that users can capture selected web content, store it locally, manage it as structured items, and generate simple copy-ready outputs.

Do not add advanced features before the local MVP works.

## 2. In Scope

### 2.1 Chrome Extension Base

- Manifest V3
- React popup
- TypeScript
- Vite
- Tailwind CSS
- Local Chrome Storage
- Context menu capture
- Content script
- Background service worker

### 2.2 Capture

User can:

- Select text on a webpage
- Right-click selected text
- Click "Save to T-eraClip"
- Save the selected text into local storage

Captured data must include:

- Selected text
- Source page title
- Source page URL
- Capture timestamp

### 2.3 Item Management

User can:

- View captured items in popup
- Edit title
- Edit type
- Edit status
- Edit priority
- Edit owner
- Edit due date
- Edit category
- Edit notes
- Mark item as done
- Archive item

### 2.4 Filters

User can filter by:

- Status
- Category

### 2.5 Reports

User can generate copy-ready text for:

- Daily report
- Follow-up list
- Waiting-for-response list
- Completed items list

### 2.6 Templates

User can generate copy-ready templates for:

- Vendor follow-up
- Internal follow-up
- Leadership summary
- Meeting action list

### 2.7 Options Page

Options page must include:

- App name
- Default report language
- Clear all local data button
- Export JSON button
- Import JSON button

## 3. Out of Scope

The following are not allowed in v0.1:

- Login
- User account
- Cloud database
- Cloud sync
- Backend API
- AI API
- API key storage
- Team workspace
- Role permissions
- Payment
- Subscription
- Email sending
- Calendar integration
- Advanced dashboard
- Mobile app
- Native desktop app
- Browser support outside Chrome
- 1Office-specific dependency
- ERP integration
- Analytics tracking
- Marketplace publishing

## 4. Required Item Types

Supported item types:

- task
- checklist
- followup
- note
- report_input

## 5. Required Status Values

Supported status values:

- inbox
- todo
- doing
- waiting
- done
- archived

## 6. Required Priority Values

Supported priority values:

- low
- medium
- high
- urgent

## 7. MVP Acceptance Criteria

The MVP is accepted only when all criteria below are met:

1. Extension loads successfully as unpacked Chrome extension.
2. Context menu appears when user selects text.
3. Selected text can be saved to local storage.
4. Saved item appears in popup.
5. Source URL and page title are saved correctly.
6. Item fields can be edited.
7. Item status can be changed.
8. Items can be filtered by status and category.
9. Daily report can be generated and copied.
10. Follow-up message can be generated and copied.
11. Options page can export JSON data.
12. Options page can import JSON data.
13. Clear all local data works.
14. No login is required.
15. No backend is required.
16. No API key is exposed.