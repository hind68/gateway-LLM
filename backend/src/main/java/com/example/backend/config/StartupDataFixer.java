package com.example.backend.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@Profile("dev")
public class StartupDataFixer {

    @Bean
    CommandLineRunner ensureRequiredUsersExist(JdbcTemplate jdbcTemplate) {
        return args -> {
            // 1. Ensure 'demo-user' exists so chat and conversations load successfully
            Integer demoCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM utilisateur WHERE external_id = 'demo-user'",
                    Integer.class
            );
            if (demoCount == null || demoCount == 0) {
                jdbcTemplate.update(
                        "INSERT INTO utilisateur (external_id, nom_affichage) VALUES ('demo-user', 'Utilisateur demo')"
                );
                System.out.println(">>> Restored 'demo-user' for conversations!");
            }

            // 2. Ensure a separate valid UUID user exists for admin panel testing
            String validUuid = "1cec697b-0000-0000-0000-000000000001";
            Integer uuidCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM utilisateur WHERE external_id = ?",
                    Integer.class,
                    validUuid
            );
            if (uuidCount == null || uuidCount == 0) {
                jdbcTemplate.update(
                        "INSERT INTO utilisateur (external_id, nom_affichage) VALUES (?, 'Test Admin User')",
                        validUuid
                );
                System.out.println(">>> Added valid UUID test user for the admin panel!");
            }
        };
    }
}