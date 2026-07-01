package com.mathtutor.auth.security;

import com.mathtutor.auth.Role;

import java.util.UUID;

/**
 * The authenticated identity carried in the security context.
 * Works for both parent and student accounts.
 */
public record AuthPrincipal(UUID id, Role role, String displayName) {
}
