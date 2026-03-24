-- Add admin_logs table and enable anon store management
CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  target_id text,
  admin_name text NOT NULL,
  details text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can view admin logs"
  ON admin_logs FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert admin logs"
  ON admin_logs FOR INSERT TO anon WITH CHECK (true);

-- Allow anon to manage stores (for admin panel)
CREATE POLICY "Anon can insert stores"
  ON stores FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update stores"
  ON stores FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon can delete stores"
  ON stores FOR DELETE TO anon USING (true);

-- Allow anon to delete requests (for admin)
CREATE POLICY "Anon can delete requests"
  ON requests FOR DELETE TO anon USING (true);

-- Allow anon to manage ratings (for admin)
CREATE POLICY "Anon can update ratings"
  ON ratings FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon can delete ratings"
  ON ratings FOR DELETE TO anon USING (true);

-- Allow anon to manage payouts (for admin)
CREATE POLICY "Anon can update payouts"
  ON payouts FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Allow anon to delete profiles (for admin)
CREATE POLICY "Anon can delete profiles"
  ON profiles FOR DELETE TO anon USING (true);
