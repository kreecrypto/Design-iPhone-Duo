# Design iPhone Duo

A browser-based foldable-phone mockup and UX presentation tool for comparing **Outer** and **Inner** display states.

> This is an independent concept/mockup project. It is not an official Apple product or Apple website.

## Product direction

The core UX principle is:

**Same task → preserve state → more space → more context**

- **Outer display** prioritizes the essential content and actions.
- **Inner display** enriches the same task with additional hierarchy and detail.
- Fold/unfold transitions should preserve user state rather than behave like separate apps.

## MVP

- Upload or drag-and-drop Outer and Inner screenshots
- Both / Outer / Inner preview modes
- Fill / Fit image modes
- Fold crease toggle
- App icon overlay toggle
- Demo screens
- Clear per display / clear all
- PNG export
- Export ratios: Auto / 16:9 / 4:3 / 1:1
- Export background selection
- Responsive desktop and mobile experience
- Local-first screenshot processing

## Repository structure

```text
.
├── README.md
├── docs/
│   ├── PROJECT_STRUCTURE.md
│   └── ARCHITECTURE.md
├── prototype/
│   └── index.html
├── src/
├── public/
├── tests/
└── .gitignore
```

## Privacy rule

User screenshots should remain in browser memory only. Do not upload screenshots to a backend and do not persist them to localStorage or IndexedDB. Persistent browser storage may only be used for non-sensitive preferences such as preview mode and toggle settings.

## Status

Project planning and backlog are maintained separately in the project Google Sheet. This repository is the implementation source of truth for code.
