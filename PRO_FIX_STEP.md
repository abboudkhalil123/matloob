# PRO Fix Step

This update fixes the three PRO issues found during QA:

1. The PRO page now presents the three actual PRO benefits instead of showing most benefits as "not active".
2. The PRO page clearly tells the supplier to contact `@abboudkhalil` on Telegram and complete payment before requesting activation. PRO is still activated only by Admin.
3. Database logic is updated so active PRO suppliers can see all open requests, receive matching-request notifications for their selected supplier categories, and request account verification.

## Required Supabase action

After extracting this project, run this SQL file in the Supabase SQL Editor:

`supabase/migrations/20260921100000_fix_pro_features.sql`

Do this once after the existing three migration batches. No previous migration should be re-run.

## QA after applying SQL

- Activate a supplier's PRO subscription from Admin.
- Confirm the supplier sees all open requests.
- Add/select a supplier category.
- Create a new open request in the same category from another account.
- Check the supplier's notifications for `طلب جديد يطابق تخصصك`.
- From the PRO supplier profile, submit a verification request and confirm it reaches Admin.
