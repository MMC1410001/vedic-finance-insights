# Admin Panel Actions Guide

This document clarifies the different delete/reset actions available in the admin panel and their effects on user data and admin privileges.

## Key Principle

**Admin access (is_admin flag) is stored in user_profiles table and is INDEPENDENT of kundali generation.**

Deleting kundalis should NOT affect admin access. Only deleting the entire user account removes admin access.

---

## Available Actions

### 1. `delete-kundalis` ✅ Preserves Admin Access
**What it does:**
- Deletes kundali reports from `kundli_reports` table
- Can delete specific kundalis by ID or all kundalis for a user

**What it does NOT touch:**
- ❌ user_profiles (admin access preserved)
- ❌ user_birth_details
- ❌ payment_orders
- ❌ Any other user data

**Use this when:**
- You want to clear a user's kundali history
- Testing kundali generation repeatedly
- User requests data deletion but wants to keep their account

**Effect on admin access:** ✅ **NO EFFECT - Admin access is preserved**

---

### 2. `reset-payment` ✅ Preserves Admin Access
**What it does:**
- Sets `has_paid = false` and `onboarding_done = false` in user_profiles
- Deletes payment_orders
- Deletes user_birth_details
- Deletes user_astrosign
- Deletes user_financial_profile

**What it does NOT touch:**
- ❌ kundli_reports (kundalis are preserved)
- ❌ user_profiles.is_admin (admin access preserved)

**Use this when:**
- Testing the payment flow
- Resetting a user to pre-payment state
- User requests refund and account reset

**Effect on admin access:** ✅ **NO EFFECT - Admin access is preserved**

---

### 3. `delete-user` ⚠️ REMOVES Admin Access
**What it does:**
- Deletes ALL user data:
  - kundli_reports
  - card_feedback
  - payment_orders
  - user_birth_details
  - user_astrosign
  - user_financial_profile
  - **user_profiles (including is_admin flag)**
  - auth.users (complete account deletion)

**Use this when:**
- Permanently removing a user account
- User requests complete data deletion (GDPR)
- Cleaning up test accounts

**Effect on admin access:** ⚠️ **REMOVES admin access** - The entire user account is deleted

---

## Granting Admin Access

Admin access is controlled by the `is_admin` column in the `user_profiles` table.

### Prerequisites
The user must have signed in at least once (they need an entry in `auth.users`).

### Method 1: Via Migration (Recommended)
Run the migration file:
```bash
# Apply migration 017
supabase db push
```

Or run the SQL directly in Supabase SQL Editor:
```sql
-- See: supabase/migrations/017_grant_admin_mayur.sql
-- Or: scripts/grant-admin.sql
```

### Method 2: Via Admin Panel UI
1. Go to `/admin`
2. Find the user in the Users list
3. Click "Make admin" button

### Method 3: Direct SQL
```sql
-- Replace with target email
INSERT INTO user_profiles (id, is_admin, onboarding_done, has_paid, created_at)
SELECT id, true, false, false, now()
FROM auth.users
WHERE email = 'mayur.chaudhary@example.com'
ON CONFLICT (id) DO UPDATE
SET is_admin = true;
```

---

## Common Mistakes

### ❌ Deleting user when you meant to delete kundalis
**Problem:** Clicking "Delete User" removes admin access
**Solution:** Use the `delete-kundalis` action instead

### ❌ Thinking you need a kundali to be an admin
**Problem:** Old code comment said "no way in short of generating a kundali"
**Solution:** Admin access is now independent - just set is_admin = true directly

### ❌ Resetting payment and expecting kundalis to be deleted
**Problem:** `reset-payment` preserves kundalis
**Solution:** Use `delete-kundalis` if you also want to clear kundali history

---

## Summary Table

| Action | Kundalis | User Profile | Admin Access | Payment Data | Birth Details | Auth Account |
|--------|----------|--------------|--------------|--------------|---------------|--------------|
| **delete-kundalis** | ✅ Deleted | ✅ Preserved | ✅ Preserved | ✅ Preserved | ✅ Preserved | ✅ Preserved |
| **reset-payment** | ✅ Preserved | ⚠️ Reset flags | ✅ Preserved | ✅ Deleted | ✅ Deleted | ✅ Preserved |
| **delete-user** | ✅ Deleted | ✅ Deleted | ❌ **REMOVED** | ✅ Deleted | ✅ Deleted | ✅ Deleted |

---

## For Developers

When adding new admin actions, remember:
- Admin access should be explicit and independent
- Document whether the action affects is_admin flag
- Consider whether user_profiles should be touched at all
- The is_admin flag is the security boundary (checked server-side in requireUser)
