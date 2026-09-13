# Project Structure

This repository mirrors the project lifecycle used in the planning workspace.

## Top-level folders

```text
Design-iPhone-Duo/
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

## Folder responsibilities

### `docs/`
Product, UX, technical architecture, decisions, release notes, and handoff documentation.

### `prototype/`
Runnable proof-of-concept builds used to validate interaction and presentation before production refactoring.

### `src/`
Production application source code. When the project is converted to a framework, keep UI, state, rendering, and export logic separated by responsibility.

Suggested structure:

```text
src/
├── app/
├── components/
├── features/
│   ├── upload/
│   ├── preview/
│   └── export/
├── state/
├── styles/
└── utils/
```

### `public/`
Static, non-sensitive assets. Do not store user-uploaded screenshots here.

### `tests/`
Functional, responsive, accessibility, and export-parity tests.

## Delivery stages

1. Foundation and reference audit
2. UX and adaptive behavior
3. Outer and Inner device rendering
4. Upload and preview controls
5. Export composer
6. Responsive and accessibility QA
7. Release and polish

## Source-of-truth rules

- Google Sheet = project planning, backlog, acceptance, QA matrix, and roadmap.
- GitHub = code implementation, technical docs, issues, branches, pull requests, and release history.
- Google Drive = research, design assets, QA evidence, and archived project deliverables.
