# Phase 3 Manual Testing Guide (Two Accounts)

This guide walks through step-by-step verification of all Phase 3 features using two student accounts:
- **Account A (Owner)**: e.g. `owner@campus.edu`
- **Account B (Renter)**: e.g. `renter@campus.edu`

---

## Prerequisites
1. Ensure the Phase 3 database migration has been run in the Supabase SQL Editor:
   ```
   supabase/migrations/20261013000100_phase3_security_fix.sql
   ```
2. Run development server:
   ```bash
   npm run dev
   ```
3. Open two browser sessions (e.g. Standard Chrome for Account A and Incognito/Safari for Account B).

---

## Test Scenarios

### 1. Account Setup & Profile Verification
1. Sign up / log in with **Account A** (`owner@campus.edu`). In `/profile`, ensure name is set to "Alice Owner" and college is "Tech Campus".
2. Sign up / log in with **Account B** (`renter@campus.edu`). In `/profile`, ensure name is set to "Bob Renter" and college is "Tech Campus".
3. Verify that student emails and phone numbers are never exposed to other users; only name, college, and verification badge are visible.

---

### 2. Listing Creation & Ownership Button Visibility
1. Log in as **Account A**.
2. Go to `/give` and create a new listing:
   - Title: `Casio FX-991EX Calculator`
   - Category: `Calculators`
   - Price: `₹30 / day`
   - Max Rental Days: `7`
   - Delivery: `Available`
   - Pickup: `Available`
   - Pickup Zone: `Library Foyer`
3. Click on the listing or navigate to `/listing/<id>`.
4. As **Account A (Owner)**:
   - Verify that **[Rent This]** and **[Contact Owner]** buttons are **HIDDEN**.
   - Verify a banner displays: `"This is your listing. Manage or edit it in My Listings."`
5. Switch to **Account B (Renter)** and visit `/listing/<id>`:
   - Verify that **[Rent This]** and **[Contact Owner]** buttons are **VISIBLE**.

---

### 3. Direct Messaging Flow & Realtime Updates
1. As **Account B (Renter)** on `/listing/<id>`, click **[Contact Owner]**.
2. Verify you are redirected to `/messages/<conv_id>`.
3. Type: `"Hi Alice, is the calculator available tomorrow at 10 AM?"` and hit Send.
4. Verify optimistic message send and instant delivery.
5. Switch to **Account A (Owner)**:
   - Notice the top navigation bar messages indicator and notifications bell badge counter increment.
   - Go to `/messages` and see the new conversation with Bob's name, college, and last message snippet.
   - Open the conversation and reply: `"Yes Bob, see you tomorrow at Library Foyer!"`.
6. Switch back to **Account B**:
   - Verify Account A's message appears in real time via Supabase Realtime without manual refresh.

---

### 4. Rental Request & Live Price Calculation
1. As **Account B (Renter)** on `/listing/<id>`, click **[Rent This]**.
2. In the rental request modal:
   - Start Date: Select today or a future date.
   - End Date: Select 3 days after start date (duration = 4 days).
   - Fulfillment: Select `Self Pickup`.
   - Payment Method: Select `Cash at Handover` or `UPI at Handover`.
3. Verify the **Live Price Calculation**:
   - Duration: `4 days`
   - Daily rate: `₹30 / day`
   - Rental amount: `₹120`
   - Security deposit: `₹0 (Guaranteed)`
   - Platform fee: `₹0 (Student Benefit)`
   - Total amount: `₹120`
4. Test validation constraints:
   - Try choosing an end date before start date -> Verify error message.
   - Try choosing a start date in the past -> Verify error message.
5. Click **[Confirm & Send Request]**.
6. Verify redirect to `/orders/<rental_id>` with status badge `REQUESTED`.

---

### 5. Overlapping Booking Prevention
1. As **Account B (Renter)**, open `/listing/<id>` again.
2. After the initial booking is accepted/confirmed, attempt to request the same item for overlapping dates.
3. Verify the system responds with an error:
   `"The selected dates overlap with an already confirmed booking for this item."`

---

### 6. Order Management & Database-Enforced Transitions
1. Log in as **Account A (Owner)** and navigate to `/orders`.
2. Under the **Rental Requests** tab, find Bob's request for the Casio Calculator.
3. Click the order to view `/orders/<rental_id>`:
   - Verify status badge is `Requested`.
   - Verify timeline has `"Rental request created"`.
   - As owner, you see **[Accept Request]** and **[Decline Request]**.
4. Click **[Accept Request]**:
   - Status updates to `Accepted`.
5. Payment step:
   - Either party marks payment as made (`Cash` or `UPI`).
   - Click **[Mark as Paid]** / **[Confirm Rental]** -> Status transitions to `Confirmed`.

---

### 7. Handover Evidence & Condition Photos
1. At item handover, on `/orders/<rental_id>`:
   - Either party clicks **[Upload Handover Photos]**.
   - Attach 1 to 6 photos (`image/*`, up to 5MB each).
   - Add condition notes: `"No scratches, batteries fully functional."`
   - Click **[Upload & Save]**.
2. Verify photos are stored in the private `rental-evidence` bucket and rendered via signed URLs in the **Condition & Return Evidence** section.
3. Click **[Confirm Handover]** -> Status changes to `Item Picked Up`.
4. Click **[Activate Rental Period]** -> Status changes to `Active Rental`.

---

### 8. Return Evidence & Order Completion
1. When rental duration finishes, as **Account B (Renter)**:
   - Click **[Request Return]** on `/orders/<rental_id>`. Status updates to `Return Requested`.
2. As **Account A (Owner)**:
   - Inspect item and click **[Return Evidence]** to record return photos.
   - Click **[Confirm Item Returned]** -> Status updates to `Returned`.
   - Click **[Mark Completed]** -> Status transitions to `Completed`.
3. Verify order status timeline displays all chronological lifecycle steps.

---

### 9. Safety Controls: Block & Report
1. In `/messages/<conv_id>`, click the 3-dots menu in the top right.
2. Click **[Report Student]**:
   - Fill in reason and submit -> Verify report is recorded.
3. Click **[Block Student]**:
   - Verify block confirmation.
   - Attempt to send another message -> Verify message sending is disabled and blocked message displays.
   - Test unblocking the student -> Verify normal messaging resumes.

---

### 10. Notifications Center
1. Navigate to `/notifications` on both accounts.
2. Verify that notifications are created automatically for:
   - New rental requests
   - Accepted / confirmed status updates
   - New incoming messages
3. Click on a notification:
   - Verify it is marked as read (dot indicator disappears).
   - Verify it navigates directly to the relevant order or chat.
4. Click **[Mark all read]** and verify all unread indicators clear.
