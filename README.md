# T-eraClip

**Clip anything. Turn it into action.**

T-eraClip is a Chrome Extension that helps users capture selected web content and turn it into structured work items such as tasks, checklist items, follow-ups, notes, and report inputs.


## Product Goal

T-eraClip aims to help users:

- Select useful text from any webpage
- Save selected content as structured work items
- Keep source URL, page title, and timestamp
- Manage captured items locally
- Generate simple reports and follow-up messages

## MVP Scope v0.1

The first version will focus on:

- Chrome Extension Manifest V3
- Right-click capture selected text
- Local browser storage
- Popup item manager
- Basic item editing
- Status and category filtering
- Simple report generation
- Copy-ready follow-up templates
- Options page for settings, export, import, and data clearing

## Out of Scope for v0.1

The following are intentionally excluded from v0.1:

- Login
- Cloud sync
- Backend server
- AI API integration
- Team workspace
- Payment system
- Advanced analytics
- External integrations

## Planned Tech Stack

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

## Documentation

Project documentation is stored in the `docs` folder:

'''text
docs/
├── PRD_v0.1.md
├── MVP_SCOPE_v0.1.md
├── ARCHITECTURE_v0.1.md
└── CODEX_PROMPTS.md

## Development Principle

This project follows an MVP-first approach.

The v0.1 product must work locally without login, backend, cloud sync, or AI. Advanced features can be considered only after the local MVP is stable.

## Repository Owner
The project PM and architecture owner controls product scope, architecture decisions, and acceptance criteria.