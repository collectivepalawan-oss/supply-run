/*
  # Add detailed store information fields

  ## Changes
  - Add contact_name, facebook_messenger, website, email fields to stores table
  - Rename address to include Google Maps link
  
  ## New Columns
  - `contact_name` (text) - Name of store contact person
  - `facebook_messenger` (text) - Facebook Messenger contact
  - `website` (text) - Store website URL
  - `email` (text) - Store email address
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'contact_name'
  ) THEN
    ALTER TABLE stores ADD COLUMN contact_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'facebook_messenger'
  ) THEN
    ALTER TABLE stores ADD COLUMN facebook_messenger text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'website'
  ) THEN
    ALTER TABLE stores ADD COLUMN website text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'email'
  ) THEN
    ALTER TABLE stores ADD COLUMN email text;
  END IF;
END $$;