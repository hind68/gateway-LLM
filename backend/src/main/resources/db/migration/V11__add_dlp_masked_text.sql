ALTER TABLE message
    ADD COLUMN IF NOT EXISTS dlp_masked_text TEXT;
