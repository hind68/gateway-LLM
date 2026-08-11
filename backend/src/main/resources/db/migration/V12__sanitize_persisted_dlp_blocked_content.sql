UPDATE message
SET dlp_masked_text = contenu
WHERE statut = 'DLP_BLOCKED'
  AND (dlp_masked_text IS NULL OR dlp_masked_text = '')
  AND contenu ~ '\[[A-Z0-9_]+_[0-9]+\]';

UPDATE message
SET contenu = dlp_masked_text
WHERE statut = 'DLP_BLOCKED'
  AND dlp_masked_text IS NOT NULL
  AND dlp_masked_text <> '';

WITH blocked AS (
    SELECT DISTINCT ON (conversation_id)
        conversation_id,
        dlp_masked_text
    FROM message
    WHERE statut = 'DLP_BLOCKED'
      AND dlp_masked_text IS NOT NULL
      AND dlp_masked_text <> ''
    ORDER BY conversation_id, ordre DESC
)
UPDATE conversation c
SET titre = LEFT('Discussion: ' || REGEXP_REPLACE(blocked.dlp_masked_text, '\s+', ' ', 'g'), 160),
    updated_at = now()
FROM blocked
WHERE c.id = blocked.conversation_id
  AND c.titre !~ '\[[A-Z0-9_]+_[0-9]+\]';
