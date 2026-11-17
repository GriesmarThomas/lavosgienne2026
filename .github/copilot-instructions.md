# Copilot instructions for La Vosgienne

## Project overview
- This repository is a static Angular 20 single-page application for the `La Vosgienne 2026` quiz game.
- The app is structured around standalone Angular components and a small service-based domain layer.
- User-facing text is primarily in French; keep the tone and wording consistent with the current UI.
- The app is designed for browser-only execution and static deployment (including Vercel), so avoid introducing server-side or build-time dependencies unless explicitly requested.
- Vercel Functions under `api/` provide the server-side API; shared handlers and storage logic belong under `server/`.
- The question bank is persisted as private JSON in Vercel Blob. `src/assets/questions/questions.json` is only the initial seed.
- Never expose Vercel Blob tokens, admin credentials, or session-signing secrets to Angular/browser code or commit them to source control.

## Architecture and conventions
- Keep application code under `src/app`.
- Use standalone components and Angular DI patterns already present in the codebase.
- Prefer the existing folder layout:
  - `src/app/pages/*` for route-level screens
  - `src/app/core/models/*` for domain types
  - `src/app/core/services/*` for shared logic
- Do not introduce NgModules unless there is a strong, explicit reason. The project already uses standalone components.
- Keep route changes in `src/app/app.routes.ts` aligned with the page structure.
- Prefer reusing the existing `QuizService` / `PunishmentService` patterns for shared state and logic instead of creating ad hoc side effects.
- When adding new features, keep local logic close to the relevant page or service and avoid unnecessary abstraction.

## Domain-specific behavior
- This app manages a quiz session through `localStorage`:
  - saved configuration (`difficulty`, `questionCount`)
  - current session (`questions`, `currentIndex`, `lastResult`)
- Preserve the existing session flow between Home -> Quiz -> Result.
- Keep validation logic resilient to browser-only execution and existing `localStorage` guards.
- Maintain support for question types used by the project (`open`, `qcm`, `image`) and their related templates.
- Respect the current business rules in `QuizService`, especially answer normalization and difficulty filtering.
- Quiz question loading must use `/api/questions` so changes made by the admin are reflected in new sessions.
- All admin question mutations must be validated server-side and require the signed, HttpOnly admin session.

## Code quality expectations
- Prefer small, surgical changes that match the current code style.
- Use `readonly` properties and constructor injection where the project already does.
- Use TypeScript types instead of `any`.
- Keep template logic readable and aligned with Angular’s current idioms.
- Prefer existing naming and file conventions over introducing new patterns.
- Do not remove working behavior while fixing a bug; preserve the quiz flow and stored state semantics.

## Validation
- Validate changes with the smallest relevant command. For this repo, the primary validation is:
  - `npm run build`
- API changes should also be checked with the Vercel Node runtime or a TypeScript check that includes `api/` and `server/`.
- Do not claim a fix is complete without a successful build.
- Keep the app production-ready and compatible with Angular 20 + Vercel deployment requirements.
