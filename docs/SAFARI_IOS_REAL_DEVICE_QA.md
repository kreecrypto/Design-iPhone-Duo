# T056 — Safari iOS real-device QA protocol

T056 cannot be closed by Playwright WebKit emulation alone. This protocol defines the minimum **real Safari on iOS** evidence required to satisfy the backlog acceptance: **Upload + export/fallback verified**.

## Test environment

Record all of the following before the test:

- Date/time (with timezone)
- Physical device model (for example, iPhone 15)
- iOS version
- Safari version/build when available
- Tested URL and Git commit SHA
- Network condition (Wi-Fi or cellular)

Do not treat an in-app browser, desktop Safari responsive mode, simulator, Playwright WebKit, Chrome on iOS, or a user-agent override as equivalent to this gate.

## Required test fixtures

Use two non-sensitive synthetic images only:

- Outer fixture: PNG, JPEG, WebP, GIF, or SVG supported by the current upload contract
- Inner fixture: visually distinct from the Outer fixture

Never use private/customer screenshots for QA evidence.

## Real-device acceptance steps

1. Open the tested build directly in **Safari on the physical iPhone**.
2. Confirm the page loads without a horizontal scrollbar and the primary controls are reachable without desktop zoom.
3. Upload the Outer fixture. Verify it appears in the Outer preview.
4. Upload the Inner fixture. Verify it appears independently in the Inner preview.
5. Switch Both → Outer → Inner → Both. Verify both uploaded previews survive the switching sequence.
6. Toggle Fill/Fit and at least one Inner overlay (Crease or App icons). Verify the preview updates without losing either uploaded image.
7. Activate **Export PNG**.
8. If Safari downloads/saves the PNG normally, verify:
   - the saved file is a PNG;
   - the filename is `design-iphone-duo-both.png` for Both mode;
   - the output contains both selected device compositions;
   - no page crash or blank output occurs.
9. If Safari blocks or cannot complete the save path, verify the accessible fallback guidance appears and instructs the user to open/use Safari or Chrome and retry. Record the observed fallback instead of marking normal download as passed.
10. Re-open/reload the page. Verify screenshots are not restored from persistent storage; non-image preferences may restore according to T028.
11. Confirm no private fixture is used and no evidence artifact contains customer/user screenshot content.

## Required evidence record

Create one evidence record using this exact field set:

```json
{
  "task": "T056",
  "device": "<physical iPhone model>",
  "ios": "<iOS version>",
  "browser": "Safari",
  "testedUrl": "<URL>",
  "commit": "<40-char Git commit SHA>",
  "testedAt": "<ISO-8601 timestamp with timezone>",
  "outerUpload": "pass|fail",
  "innerUpload": "pass|fail",
  "stateSwitching": "pass|fail",
  "responsiveNoHorizontalOverflow": "pass|fail",
  "exportPath": "download|fallback|fail",
  "pngFilename": "design-iphone-duo-both.png|not-applicable",
  "pngContentVerified": "pass|fail|not-applicable",
  "screenshotsNotPersistedAfterReload": "pass|fail",
  "notes": "<short observation>"
}
```

A record is eligible to close T056 only when:

- `browser` is exactly `Safari`;
- `device` is a physical iPhone model, not simulator/emulation;
- Outer upload, Inner upload, state switching, responsive overflow, and screenshot non-persistence are all `pass`;
- `exportPath` is either `download` with filename/content checks passing, or `fallback` with the fallback guidance observed and described in `notes`;
- the commit SHA matches the build under test.

## Evidence handling

Keep evidence privacy-safe. Prefer a text/JSON record plus UI-only screenshots that contain synthetic fixtures. Do not commit device identifiers, Apple IDs, IP addresses, private photos, customer data, or uploaded user screenshots.

## Existing proxy evidence

The automated Playwright WebKit + iPhone-profile test remains useful regression coverage for local uploads, PNG export, privacy, responsive layout, and blocked-save fallback. It is **supporting evidence only** and does not replace this real-device gate.
