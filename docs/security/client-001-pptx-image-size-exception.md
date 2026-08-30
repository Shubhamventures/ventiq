# VENTIQ Client 001 Pilot Dependency Exception — PptxGenJS / image-size

## Status

**Controlled paid-pilot exception only.** This is not a declaration that the vulnerable package is safe or fixed.

## Dependency chain

- `pptxgenjs@4.0.1`
- transitive `image-size@1.2.1`
- npm audit currently reports high-severity denial-of-service findings against `image-size`.

## VENTIQ reachability evidence

CR-P0.3B established that:

- VENTIQ has exactly one PptxGenJS importer: `app/api/lp-deck/generate/route.ts`.
- That route does not call `addImage()` or `addMedia()`.
- It does not use PptxGenJS image sizing helpers.
- `DeckRequestBody` exposes no image/media/file/url/path/data-uri input field.
- Current LP deck generation is limited to constructed text, shape, and chart objects.

Therefore the vulnerable image parsing path is not reachable through the current VENTIQ LP deck source.

## Pilot control

The exception remains valid only while all of the following are true:

1. PptxGenJS remains imported only by `app/api/lp-deck/generate/route.ts`.
2. The route does not call PptxGenJS image/media APIs.
3. The request contract accepts no image/media/file/url/path/data-uri input.
4. `scripts/security-pptx-image-path-guard.mjs` passes before a Client 001 release.
5. No image/logo/media upload feature is added to LP deck generation.

## Expiry / mandatory review triggers

Re-review and remove this exception when any of the following occurs:

- PptxGenJS or `image-size` publishes a safe upstream dependency path.
- VENTIQ adds image/media handling to LP deck generation.
- PptxGenJS is imported by another VENTIQ module.
- The application expands beyond the controlled Client 001 pilot.
- A new advisory changes exploitability or affected code paths.

## Long-term remediation

Prefer an upstream-fixed PptxGenJS release or a replacement PPTX generation path that does not install the vulnerable image parser.

This exception is a risk treatment for a constrained pilot, not a substitute for eventual dependency remediation.
