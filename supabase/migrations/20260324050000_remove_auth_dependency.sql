/*
  # Remove Supabase Auth dependency

  Switches the app to a passcode-based community auth model:
  - Removes the auth.users foreign key from profiles so IDs are standalone UUIDs
  - Drops authenticated-only RLS policies
  - Creates permissive anon policies for community access
*/

-- Remove auth.users FK from profiles (IDs are now self-generated UUIDs)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- ==================== profiles ====================
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Anon can view profiles"
  ON profiles FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert profiles"
  ON profiles FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update profiles"
  ON profiles FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ==================== responders ====================
DROP POLICY IF EXISTS "Anyone can view verified responders" ON responders;
DROP POLICY IF EXISTS "Users can insert own responder profile" ON responders;
DROP POLICY IF EXISTS "Users can update own responder profile" ON responders;

CREATE POLICY "Anon can view verified responders"
  ON responders FOR SELECT TO anon USING (verified = true);

CREATE POLICY "Anon can insert responder profiles"
  ON responders FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update responder profiles"
  ON responders FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ==================== requests ====================
DROP POLICY IF EXISTS "Anyone can view open requests" ON requests;
DROP POLICY IF EXISTS "Users can create own requests" ON requests;
DROP POLICY IF EXISTS "Requesters can update own requests" ON requests;
DROP POLICY IF EXISTS "Responders can update claimed requests" ON requests;

CREATE POLICY "Anon can view requests"
  ON requests FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert requests"
  ON requests FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update requests"
  ON requests FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ==================== stores ====================
DROP POLICY IF EXISTS "Anyone can view stores" ON stores;
DROP POLICY IF EXISTS "Only admins can manage stores" ON stores;

CREATE POLICY "Anon can view stores"
  ON stores FOR SELECT TO anon USING (true);

-- ==================== ratings ====================
DROP POLICY IF EXISTS "Anyone can view unflagged ratings" ON ratings;
DROP POLICY IF EXISTS "Requesters can create ratings for completed requests" ON ratings;

CREATE POLICY "Anon can view unflagged ratings"
  ON ratings FOR SELECT TO anon USING (flagged = false);

CREATE POLICY "Anon can insert ratings"
  ON ratings FOR INSERT TO anon WITH CHECK (true);

-- ==================== payouts ====================
DROP POLICY IF EXISTS "Responders can view own payouts" ON payouts;
DROP POLICY IF EXISTS "Responders can create payout requests" ON payouts;
DROP POLICY IF EXISTS "Admins can manage all payouts" ON payouts;

CREATE POLICY "Anon can view payouts"
  ON payouts FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert payouts"
  ON payouts FOR INSERT TO anon WITH CHECK (true);
