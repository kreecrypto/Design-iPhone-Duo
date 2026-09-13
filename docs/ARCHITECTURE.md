# Architecture

## Product model

The tool is local-first and browser-based. Uploaded screenshots are handled in memory and rendered into Outer and Inner device previews.

## Core modules

### Upload
- Accept PNG, JPG, WebP, GIF, and SVG where browser-safe.
- Drag and drop and file-picker entry points.
- Maintain separate Outer and Inner image state.
- Validate file type and decode failures.

### Preview
- Display modes: Both / Outer / Inner.
- Image modes: Fill / Fit.
- Optional fold-crease overlay.
- Optional app-icon overlay.
- Preserve state while switching display modes.

### Responsive behavior
- Mobile: controls may scroll horizontally; previews stack vertically.
- Tablet: retain readable controls and a centered preview.
- Desktop: side-by-side Outer and Inner preview when space allows.
- Avoid tying application behavior to one fixed physical device dimension.

### Export
- Compose only the selected preview state.
- Ratios: Auto / 16:9 / 4:3 / 1:1.
- Background selection.
- PNG output must visually match the preview state.
- Provide an iOS/in-app-browser fallback when automatic download is restricted.

## Privacy constraints

- No backend screenshot upload.
- No screenshot persistence in localStorage or IndexedDB.
- Revoke object URLs when screenshots are replaced or cleared.
- Preferences may be persisted only if they contain no user imagery or sensitive data.

## Accessibility constraints

- All toolbar controls must be keyboard operable.
- Toggles expose state via accessible labels/ARIA.
- Upload controls have visible focus states.
- Mobile layout must avoid horizontal page scrolling at 320 px.
- Text contrast should meet WCAG AA for core UI.

## Suggested production separation

```text
src/
├── app/
│   └── bootstrap
├── components/
│   ├── Toolbar
│   ├── DeviceFrame
│   ├── UploadControl
│   └── ExportDialog
├── features/
│   ├── upload/
│   ├── preview/
│   └── export/
├── state/
│   └── preview-store
├── utils/
│   ├── image
│   └── export
└── styles/
```

## Launch gates

1. Outer and Inner upload both work.
2. Preview state survives mode changes.
3. Export output matches preview.
4. No screenshot leaves the browser during the core flow.
5. Mobile layout works from 320 px upward.
6. Keyboard flow covers all primary interactions.
