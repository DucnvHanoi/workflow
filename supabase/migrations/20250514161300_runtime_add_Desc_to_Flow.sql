ALTER TABLE flows
  ADD COLUMN description text
  CONSTRAINT flows_description_length CHECK (char_length(description) <= 500);
-- 500 chars server-side gives room; we enforce 100 words in the UI