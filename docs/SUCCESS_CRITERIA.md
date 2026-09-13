# MVP Success Criteria

This document mirrors the Google Sheet `17_Acceptance` contract so implementation and QA in GitHub stay traceable. A criterion is only considered passed when the linked verification method has concrete evidence; implementation alone is not proof of acceptance.

| ID | Area | Success criterion | Verification | Linked work | Priority |
| --- | --- | --- | --- | --- | --- |
| AC-001 | Upload | Outer and inner accept supported image formats without sending image bytes to a server. | Functional test + network inspection | FT-001/FT-002/T044 | P0 |
| AC-002 | State | Switching Both/Outer/Inner never loses loaded images during the session. | Functional QA | FT-003–005/T048 | P0 |
| AC-003 | Image fit | Fill and Fit never distort aspect ratio. | Visual QA | FT-006/007 | P0 |
| AC-004 | Inner realism | Crease and icon overlays are independently toggleable and do not block interaction. | Functional QA | FT-008/009 | P1 |
| AC-005 | Export | PNG output matches chosen scope, fit mode, overlays, ratio and background. | Fixture visual comparison | FT-013–016/T050 | P0 |
| AC-006 | Mobile | Core flow works at 320px width without horizontal scrolling. | Responsive QA | FT-017/T052 | P0 |
| AC-007 | iOS | If direct PNG save is unavailable, user gets clear browser fallback guidance. | Real-device QA | T040/T056 | P0 |
| AC-008 | Accessibility | All core controls are keyboard operable with visible focus. | Keyboard QA | FT-018/T060 | P0 |
| AC-009 | Privacy | No uploaded screenshot bytes are persisted in localStorage/IndexedDB by default. | Storage audit | PR-002/T062 | P0 |
| AC-010 | Originality | Visual assets/copy are original and product is clearly labeled as concept/tool, not an official Apple product. | Design/legal review | R-001/R-002 | P0 |

## Evidence rule

For each acceptance item, evidence must identify the tested commit/build and the verification result. Automated checks should link the workflow run; visual, device, accessibility, legal, and manual checks should link their recorded QA artifact or Sheet evidence. Do not mark an acceptance item `Done` only because its implementation task is complete.

## Release gate

MVP release is blocked until every P0 criterion above has passing evidence. P1 criteria may remain open only when the Master Plan explicitly permits deferral and the open gap does not invalidate a P0 criterion.
