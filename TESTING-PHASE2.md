# TESTING‑PHASE2

## Unit Tests (Vitest)
```
npm run test
```
Runs the Vitest suite which includes:
- `listingSchema.test.ts` – validates the Zod listing schema.
- `favoritesApi.test.ts` – tests the Favorites API POST/DELETE routes with a mocked Supabase client.

## End‑to‑End Tests (Playwright)
```
npx playwright test
```
The Playwright tests cover:
- **Home page recent listings** – ensures the "Recent Listings" section renders and at least one listing card is present.
- **My Listings page** – logs in with a test account and checks that the authenticated user's listings appear.

### Running the tests locally
1. Ensure the development server is running (`npm run dev`).
2. Install Playwright browsers (first time only): `npx playwright install`.
3. Execute the test commands above. All tests should pass.

---
