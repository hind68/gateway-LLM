CREATE TABLE attachment (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES message(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(160) NOT NULL,
    size BIGINT NOT NULL,
    dlp_decision VARCHAR(20) NOT NULL,
    extraction_status VARCHAR(80) NOT NULL,
    extracted_text TEXT,
    masked_text TEXT,
    matches_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachment_message_id ON attachment(message_id);
