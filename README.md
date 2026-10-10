# RENTIQ - Rent Smart. Spend Less.

RENTIQ is a student-only platform for rentals, printing/Xerox, and campus delivery.

---

## 🚀 Quick Setup Instructions

### 1. Supabase Project Setup
1. Log in to [Supabase Console](https://supabase.com) and create a new project.
2. In the Supabase Dashboard, go to **SQL Editor**.
3. Copy the migration file contents from [`supabase/migrations/20261009000000_phase1_schema.sql`](supabase/migrations/20261009000000_phase1_schema.sql) and run it in the SQL Editor.
   - This creates `profiles`, `user_roles` tables, auto-creation trigger on user signup, field protection triggers, Row Level Security (RLS) policies, public profile view, and the `profile-photos` storage bucket.

### 2. Environment Configuration
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in your Supabase project credentials in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

### 3. Install Dependencies & Run Development Server
```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Tests

### Unit Tests (Vitest)
Runs tests for logged-out route redirects, public profile privacy field filtering, and role/verification-status tampering protection:
```bash
npm run test
```

### End-to-End Tests (Playwright)
Runs cross-browser tests across Chromium and WebKit (iOS Safari approximation) covering login/signup flows, redirects, bottom navigation, and 16px+ input font size rules:
```bash
# Install Playwright browsers (first time)
npx playwright install

# Run E2E tests
npx playwright test
```

---

## 🔒 Security Features (Phase 1)
- **Row Level Security (RLS)**: Enforced on `profiles` and `user_roles`.
- **Private Field Protection**: Other users can access only public profile fields (`name`, `college`, `profile_photo_url`, `verification_status`) via `public_profiles` view.
- **Role & Status Protection**: Users cannot modify their own `roles` or `verification_status` (enforced via DB triggers and API input sanitization).
- **Storage Protection**: Users can only upload and modify files in their own folder (`profile-photos/{user_id}/*`).
- **Rate Limiting**: Sliding window rate limiting on `/login`, `/signup`, and `/reset-password`.
- **Validation**: Strict client and server validation using Zod and image type/size checks.

---

## 📱 Mobile-First Cross-Platform Rules
- Minimum `16px` font size on inputs to prevent iOS auto-zoom.
- `dvh` / `svh` layout heights.
- Safe area inset padding (`env(safe-area-inset-bottom)`) for fixed bottom navigation.
- Minimum 44px touch targets.
- iPhone PWA "Add to Home Screen" instructions banner.
