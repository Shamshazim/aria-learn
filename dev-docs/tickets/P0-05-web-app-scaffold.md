# P0-05 — Web app scaffold (React + TypeScript + Vite)

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Frontend |
| **Depends on** | P0-01 |
| **Blocks** | P0-06, P0-08, P0-25 |
| **Parallel-safe with** | P0-02, P0-03, P0-04 |
| **Size** | M |

## Why

The session UI arrives in P0-06 and must land in a tree that already has the layering,
routing, API client and design tokens it will need. Copying UI into an empty folder and
sorting the structure out afterwards is how the old frontend got the way it was.

## Scope

### Build
The `apps/web` application shell: Vite, React 19, the folder contract from
`CODE-STANDARDS.md` §3.2, the router, the HTTP client, the error boundary, the design-token
stylesheet and the test setup.

### Do not build
- No session screens. P0-06.
- No protocol handling. P0-08.
- No auth screens. Blocked on P0-26.

## Design

```
apps/web/
  index.html
  vite.config.ts            path alias @/ -> src/, proxy /api -> localhost:3000 in dev
  src/
    main.tsx                mount only
    app/
      App.tsx               providers + router outlet. Composition only.
      providers.tsx         query client, error boundary, config context
      router.tsx            route table, lazy pages
    pages/
      HomePage.tsx          placeholder; becomes arrival in P1-12
      NotFoundPage.tsx
    api/
      client.ts             the single fetch wrapper: base url, json, errors, timeout,
                            x-request-id, abort signal
      errors.ts             ApiError with the server's code, mapped to UI-safe text
      index.ts
    components/
      ErrorBoundary.tsx
      LoadingState.tsx
    lib/
      assert.ts, result.ts  framework-free helpers, unit tested
    styles/
      tokens.css            colour, type scale, spacing, radius, motion — one source
      global.css
    types/
    test/
      setup.ts              jsdom, testing-library, matchMedia + audio stubs
```

Rules fixed here:
- **`api/client.ts` is the only file in the app that calls `fetch`.** Everything else goes
  through an endpoint module. A component that fetches is a review rejection.
- Every response is parsed with the zod schema from `@aria/shared` before it becomes state.
  A network response is untrusted input.
- Design tokens live in `styles/tokens.css` as CSS custom properties. No hard-coded colour,
  font size or spacing value in a component. The carried-forward `session.css` is brought
  onto these tokens in P0-06.
- `prefers-reduced-motion` is respected globally, and the app is keyboard operable from the
  first commit.
- One error boundary at the app shell, one per route section; a thrown render error never
  shows a child a blank screen.

## Acceptance criteria

- [ ] `npm run dev -w @aria/web` serves the shell; `npm run build -w @aria/web` produces a
      clean production build with no type errors.
- [ ] `/api` proxies to the API in development; the base URL is configurable by env for
      production, with `.env.example` updated.
- [ ] `api/client.ts` surfaces timeouts, non-2xx responses and malformed JSON as typed
      `ApiError`s, unit tested with a stubbed fetch.
- [ ] A thrown error in a page renders the error boundary, not a white screen.
- [ ] Vitest + testing-library run in jsdom; one example component test passes.
- [ ] Axe has no violations on the shell.
- [ ] No component imports `fetch`; enforced by a lint restriction.

## Verification

```bash
npm run build -w @aria/web
npm run test -w @aria/web
```

## References

- `CODE-STANDARDS.md` §3.2
- `rewrite.md` §4, §5 step 1
