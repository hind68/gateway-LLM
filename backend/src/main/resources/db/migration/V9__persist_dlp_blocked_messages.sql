ALTER TABLE message
    DROP CONSTRAINT IF EXISTS message_statut_check;

ALTER TABLE message
    ADD CONSTRAINT message_statut_check
        CHECK (statut IN ('EN_COURS', 'TERMINE', 'ECHEC', 'DLP_BLOCKED'));

ALTER TABLE message
    ADD COLUMN dlp_highest_severity VARCHAR(20),
    ADD COLUMN dlp_detected_types TEXT;
