package com.mathtutor.desktop;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.nio.charset.StandardCharsets;

/**
 * Refuses to start a desktop build that is not properly secured.
 *
 * The development configuration carries a checked-in JWT secret so contributors can run the
 * app with no setup. That is fine on a laptop and unacceptable in a shipped installer: every
 * copy would sign tokens with a key that is public on GitHub, so anyone could mint a valid
 * parent token for any family's install. The launcher generates a random secret per
 * installation; this guard makes sure that actually happened rather than trusting it.
 */
@Configuration
@Profile("desktop")
public class DesktopEnvironmentGuard {

    private static final Logger log = LoggerFactory.getLogger(DesktopEnvironmentGuard.class);

    /** Any secret shipped in source control. Matching one is a hard failure. */
    private static final String DEV_SECRET_MARKER = "change-me-in-prod";

    /** HS256 keys shorter than this are rejected by the JWT library anyway. */
    private static final int MIN_SECRET_BYTES = 32;

    private final String jwtSecret;

    public DesktopEnvironmentGuard(@Value("${app.jwt.secret:}") String jwtSecret) {
        this.jwtSecret = jwtSecret;
    }

    @PostConstruct
    void verify() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                    "Desktop build started without a JWT secret. The launcher must provide JWT_SECRET.");
        }
        if (jwtSecret.contains(DEV_SECRET_MARKER)) {
            throw new IllegalStateException(
                    "Desktop build started with the development JWT secret. "
                            + "The launcher must generate a unique secret per installation.");
        }
        if (jwtSecret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "Desktop JWT secret is too short; need at least " + MIN_SECRET_BYTES + " bytes.");
        }
        log.info("Desktop environment verified: per-install signing key in use");
    }
}
