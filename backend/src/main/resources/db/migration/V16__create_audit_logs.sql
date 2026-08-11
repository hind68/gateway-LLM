CREATE TABLE audit_logs (
                            id BIGSERIAL PRIMARY KEY,
                            action VARCHAR(255) NOT NULL,
                            entity_name VARCHAR(255) NOT NULL,
                            entity_id VARCHAR(255),
                            performed_by UUID NOT NULL,
                            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);