ALTER TABLE message
    ADD COLUMN dlp_highest_severity VARCHAR(20),
    ADD COLUMN dlp_detected_types TEXT,
    ADD COLUMN dlp_matches_json TEXT,
    ADD COLUMN dlp_masked_text TEXT;
