/*
  # Make profile fields optional for anonymous access

  Users can now enter the passcode and use the app immediately without
  providing a name or WhatsApp number. Profile fields are now optional
  and can be filled in later via the Edit Profile screen.

  To roll back: ALTER TABLE profiles ALTER COLUMN full_name SET NOT NULL,
                               ALTER COLUMN whatsapp_number SET NOT NULL,
                               ALTER COLUMN location_barangay SET NOT NULL;
  (Only safe if all existing rows already have non-null values.)
*/

ALTER TABLE profiles
  ALTER COLUMN full_name DROP NOT NULL,
  ALTER COLUMN whatsapp_number DROP NOT NULL,
  ALTER COLUMN location_barangay DROP NOT NULL;
