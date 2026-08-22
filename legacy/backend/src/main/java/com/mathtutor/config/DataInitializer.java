package com.mathtutor.config;

import com.mathtutor.auth.Parent;
import com.mathtutor.auth.ParentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds a default parent account for local development so the platform is usable
 * immediately after first run.
 *
 * Disabled under "prod" and, critically, under "desktop": a shipped installer that created
 * parent@demo.com/parent123 on every machine would hand anyone who read this repository a
 * working login to every family's install. Desktop builds start with an empty parents table
 * and the parent creates the only account through the first-run wizard (see SetupService).
 */
@Component
@Profile("!prod & !desktop")
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private static final String DEFAULT_EMAIL = "parent@demo.com";
    private static final String DEFAULT_PASSWORD = "parent123";

    private final ParentRepository parentRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(ParentRepository parentRepository, PasswordEncoder passwordEncoder) {
        this.parentRepository = parentRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (parentRepository.existsByEmailIgnoreCase(DEFAULT_EMAIL)) {
            return;
        }
        Parent parent = new Parent();
        parent.setEmail(DEFAULT_EMAIL);
        parent.setName("Demo Parent");
        parent.setPasswordHash(passwordEncoder.encode(DEFAULT_PASSWORD));
        parentRepository.save(parent);
        log.info("Seeded default parent account: {} / {}", DEFAULT_EMAIL, DEFAULT_PASSWORD);
    }
}
