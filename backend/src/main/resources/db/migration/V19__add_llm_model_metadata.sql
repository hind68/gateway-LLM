ALTER TABLE modele_llm
    ADD COLUMN description VARCHAR(500),
    ADD COLUMN logo_url VARCHAR(500);

UPDATE modele_llm
SET description = CASE alias_interne
        WHEN 'secure-gpt' THEN 'Modèle généraliste OpenAI pour les usages quotidiens.'
        WHEN 'secure-groq' THEN 'Modèle rapide pour des réponses réactives.'
        WHEN 'secure-gemini' THEN 'Modèle polyvalent pour explorer et structurer des idées.'
        WHEN 'secure-mistral' THEN 'Modèle efficace pour les tâches pratiques et les synthèses.'
        ELSE 'Modèle disponible dans le gateway.'
    END
WHERE description IS NULL;
