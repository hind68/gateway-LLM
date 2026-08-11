ALTER TABLE message
    DROP CONSTRAINT IF EXISTS message_statut_check;

ALTER TABLE message
    ADD CONSTRAINT message_statut_check
        CHECK (statut IN ('EN_COURS', 'TERMINE', 'ECHEC', 'DLP_BLOCKED'));
