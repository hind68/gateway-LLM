ALTER TABLE fournisseur_llm
    ADD COLUMN api_key_env_var VARCHAR(100);

COMMENT ON COLUMN fournisseur_llm.api_key_env_var IS
    'Environment variable containing the provider API key; the secret itself is never stored in the database.';
