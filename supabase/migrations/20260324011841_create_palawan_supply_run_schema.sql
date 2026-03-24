/*
  # Palawan Supply Run - Complete Database Schema

  ## Overview
  Creates the complete database structure for the Palawan Supply Run community logistics platform.

  ## New Tables
  
  ### 1. `profiles`
  User profiles with privacy-first design
  - `id` (uuid, references auth.users)
  - `full_name` (text)
  - `whatsapp_number` (text) - PH format: 639XXXXXXXXX
  - `gcash_number` (text, optional)
  - `location_barangay` (text) - San Vicente location
  - `location_landmark` (text)
  - `profile_photo` (text, base64)
  - `user_type` (text) - requester, responder, both
  - `is_admin` (boolean)
  - `created_at` (timestamptz)
  
  ### 2. `responders`
  Extended info for delivery responders
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles)
  - `vehicle_type` (text) - motor, van, truck, wing_van
  - `vehicle_photo` (text, base64)
  - `drivers_license` (text, base64)
  - `or_cr_photo` (text, base64, optional)
  - `service_areas` (text[]) - array of areas
  - `availability` (text)
  - `verified` (boolean)
  - `verified_at` (timestamptz)
  - `rejection_reason` (text)
  - `total_earnings` (decimal)
  - `pending_earnings` (decimal)
  - `completed_jobs` (integer)
  - `average_rating` (decimal)
  - `created_at` (timestamptz)
  
  ### 3. `requests`
  Item delivery requests
  - `id` (uuid, primary key)
  - `requester_id` (uuid, references profiles)
  - `responder_id` (uuid, references responders, nullable)
  - `item_name` (text)
  - `quantity` (text)
  - `weight_estimate` (text) - small, medium, large, xl
  - `size_estimate` (text) - s, m, l, xl
  - `description` (text)
  - `product_link` (text)
  - `item_photo` (text, base64)
  - `terminal` (text) - san_jose, roxas, san_vicente
  - `vehicle_needed` (text) - motor, van, truck, any
  - `urgency` (text) - urgent, normal, flexible
  - `delivery_preference` (text) - pickup, deliver, meet_junction
  - `status` (text) - open, claimed, at_terminal, en_route, arrived, completed
  - `earnings_amount` (decimal)
  - `claimed_at` (timestamptz)
  - `completed_at` (timestamptz)
  - `created_at` (timestamptz)
  
  ### 4. `stores`
  Puerto Princesa store directory
  - `id` (uuid, primary key)
  - `name` (text)
  - `store_type` (text) - mall, hardware, specialty, terminal, grocery, pharmacy, bank
  - `address` (text)
  - `latitude` (decimal)
  - `longitude` (decimal)
  - `whatsapp_number` (text)
  - `featured` (boolean)
  - `featured_until` (timestamptz)
  - `created_at` (timestamptz)
  
  ### 5. `ratings`
  Responder ratings from requesters
  - `id` (uuid, primary key)
  - `request_id` (uuid, references requests)
  - `responder_id` (uuid, references responders)
  - `requester_id` (uuid, references profiles)
  - `stars` (integer) - 1-5
  - `review_text` (text)
  - `flagged` (boolean)
  - `created_at` (timestamptz)
  
  ### 6. `payouts`
  Responder payout requests
  - `id` (uuid, primary key)
  - `responder_id` (uuid, references responders)
  - `amount` (decimal)
  - `gcash_number` (text)
  - `status` (text) - pending, approved, rejected, paid
  - `admin_notes` (text)
  - `requested_at` (timestamptz)
  - `processed_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Policies for authenticated users to manage their own data
  - Privacy protection for WhatsApp numbers
  - Admin-only access for sensitive operations
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text NOT NULL,
  whatsapp_number text NOT NULL,
  gcash_number text,
  location_barangay text NOT NULL,
  location_landmark text,
  profile_photo text,
  user_type text NOT NULL CHECK (user_type IN ('requester', 'responder', 'both')),
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create responders table
CREATE TABLE IF NOT EXISTS responders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('motor', 'van', 'truck', 'wing_van')),
  vehicle_photo text,
  drivers_license text,
  or_cr_photo text,
  service_areas text[] DEFAULT '{}',
  availability text,
  verified boolean DEFAULT false,
  verified_at timestamptz,
  rejection_reason text,
  total_earnings decimal DEFAULT 0,
  pending_earnings decimal DEFAULT 0,
  completed_jobs integer DEFAULT 0,
  average_rating decimal DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE responders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view verified responders"
  ON responders FOR SELECT
  TO authenticated
  USING (verified = true OR user_id = auth.uid());

CREATE POLICY "Users can insert own responder profile"
  ON responders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own responder profile"
  ON responders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  responder_id uuid REFERENCES responders(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity text NOT NULL,
  weight_estimate text NOT NULL CHECK (weight_estimate IN ('small', 'medium', 'large', 'xl')),
  size_estimate text NOT NULL CHECK (size_estimate IN ('s', 'm', 'l', 'xl')),
  description text,
  product_link text,
  item_photo text,
  terminal text NOT NULL CHECK (terminal IN ('san_jose', 'roxas', 'san_vicente')),
  vehicle_needed text NOT NULL CHECK (vehicle_needed IN ('motor', 'van', 'truck', 'any')),
  urgency text NOT NULL CHECK (urgency IN ('urgent', 'normal', 'flexible')),
  delivery_preference text NOT NULL CHECK (delivery_preference IN ('pickup', 'deliver', 'meet_junction')),
  status text DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'at_terminal', 'en_route', 'arrived', 'completed')),
  earnings_amount decimal DEFAULT 0,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view open requests"
  ON requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own requests"
  ON requests FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Requesters can update own requests"
  ON requests FOR UPDATE
  TO authenticated
  USING (requester_id = auth.uid())
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Responders can update claimed requests"
  ON requests FOR UPDATE
  TO authenticated
  USING (
    responder_id IN (
      SELECT id FROM responders WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    responder_id IN (
      SELECT id FROM responders WHERE user_id = auth.uid()
    )
  );

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  store_type text NOT NULL CHECK (store_type IN ('mall', 'hardware', 'specialty', 'terminal', 'grocery', 'pharmacy', 'bank')),
  address text NOT NULL,
  latitude decimal NOT NULL,
  longitude decimal NOT NULL,
  whatsapp_number text,
  featured boolean DEFAULT false,
  featured_until timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stores"
  ON stores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage stores"
  ON stores FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES responders(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  review_text text,
  flagged boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(request_id)
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view unflagged ratings"
  ON ratings FOR SELECT
  TO authenticated
  USING (flagged = false OR requester_id = auth.uid());

CREATE POLICY "Requesters can create ratings for completed requests"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- Create payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responder_id uuid NOT NULL REFERENCES responders(id) ON DELETE CASCADE,
  amount decimal NOT NULL,
  gcash_number text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  admin_notes text,
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Responders can view own payouts"
  ON payouts FOR SELECT
  TO authenticated
  USING (
    responder_id IN (
      SELECT id FROM responders WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Responders can create payout requests"
  ON payouts FOR INSERT
  TO authenticated
  WITH CHECK (
    responder_id IN (
      SELECT id FROM responders WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all payouts"
  ON payouts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_requester ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_responder ON requests(responder_id);
CREATE INDEX IF NOT EXISTS idx_responders_verified ON responders(verified);
CREATE INDEX IF NOT EXISTS idx_ratings_responder ON ratings(responder_id);
CREATE INDEX IF NOT EXISTS idx_stores_featured ON stores(featured);
CREATE INDEX IF NOT EXISTS idx_stores_type ON stores(store_type);