CREATE TABLE filtered_messages (
                                   id BIGSERIAL PRIMARY KEY,
                                   user_keycloak_id UUID NOT NULL,
                                   original_content TEXT NOT NULL,
                                   redacted_content TEXT,
                                   action VARCHAR(50) NOT NULL, -- 'BLOCKED' or 'REDACTED'
                                   reason VARCHAR(255) NOT NULL,
                                   timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);