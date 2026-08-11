ALTER TABLE filtered_messages
    ADD COLUMN highest_severity VARCHAR(50),
    ADD COLUMN detected_types TEXT,
    ADD COLUMN detection_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN request_status VARCHAR(50) NOT NULL DEFAULT 'FAILED';
