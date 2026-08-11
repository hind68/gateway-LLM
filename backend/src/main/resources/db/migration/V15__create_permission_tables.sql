CREATE TABLE user_llm_restrictions (
    id              BIGSERIAL PRIMARY KEY,
    user_keycloak_id UUID NOT NULL,
    llm_model_alias VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL,
    CONSTRAINT uq_user_llm_restriction
        UNIQUE (user_keycloak_id, llm_model_alias)
);

CREATE INDEX idx_user_llm_restrictions_user
    ON user_llm_restrictions (user_keycloak_id);


CREATE TABLE role_llm_restrictions (
    id              BIGSERIAL PRIMARY KEY,
    role_name       VARCHAR(255) NOT NULL,
    llm_model_alias VARCHAR(255) NOT NULL
);


CREATE TABLE global_banned_words (
    id          BIGSERIAL PRIMARY KEY,
    word        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID NOT NULL,
    CONSTRAINT uq_global_banned_word
        UNIQUE (word)
);


CREATE TABLE user_banned_words (
    id              BIGSERIAL PRIMARY KEY,
    user_keycloak_id UUID NOT NULL,
    word            VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL,
    CONSTRAINT uq_user_banned_word
        UNIQUE (user_keycloak_id, word)
);

CREATE INDEX idx_user_banned_words_user
    ON user_banned_words (user_keycloak_id);


CREATE TABLE role_banned_words (
    id        BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(255) NOT NULL,
    word      VARCHAR(255) NOT NULL
);