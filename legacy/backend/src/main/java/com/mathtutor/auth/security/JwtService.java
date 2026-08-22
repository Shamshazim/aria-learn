package com.mathtutor.auth.security;

import com.mathtutor.auth.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    private final SecretKey key;
    private final long accessTtlMinutes;
    private final long refreshTtlDays;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-token-ttl-minutes}") long accessTtlMinutes,
            @Value("${app.jwt.refresh-token-ttl-days}") long refreshTtlDays) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtlMinutes = accessTtlMinutes;
        this.refreshTtlDays = refreshTtlDays;
    }

    public String generateAccessToken(UUID id, Role role, String displayName) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(id.toString())
                .claim("role", role.name())
                .claim("name", displayName)
                .claim("type", "access")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtlMinutes, ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    public String generateRefreshToken(UUID id, Role role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(id.toString())
                .claim("role", role.name())
                .claim("type", "refresh")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(refreshTtlDays, ChronoUnit.DAYS)))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public AuthPrincipal toPrincipal(Claims claims) {
        return new AuthPrincipal(
                UUID.fromString(claims.getSubject()),
                Role.valueOf(claims.get("role", String.class)),
                claims.get("name", String.class));
    }
}
