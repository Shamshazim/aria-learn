package com.mathtutor.auth;

import com.mathtutor.auth.dto.AuthDtos.LoginRequest;
import com.mathtutor.auth.dto.AuthDtos.TokenResponse;
import com.mathtutor.auth.security.JwtService;
import io.jsonwebtoken.Claims;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuthService {

    private final ParentRepository parentRepository;
    private final StudentRepository studentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(ParentRepository parentRepository,
                       StudentRepository studentRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.parentRepository = parentRepository;
        this.studentRepository = studentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public TokenResponse login(LoginRequest req) {
        String id = req.usernameOrEmail().trim();

        // Try parent (email) first, then student (username).
        var parentOpt = parentRepository.findByEmailIgnoreCase(id);
        if (parentOpt.isPresent()) {
            Parent parent = parentOpt.get();
            if (parent.isActive() && passwordEncoder.matches(req.password(), parent.getPasswordHash())) {
                return buildTokens(parent.getId(), Role.PARENT, parent.getName());
            }
            throw new BadCredentialsException("Invalid credentials");
        }

        var studentOpt = studentRepository.findByUsernameIgnoreCase(id);
        if (studentOpt.isPresent()) {
            Student student = studentOpt.get();
            if (student.isActive() && passwordEncoder.matches(req.password(), student.getPasswordHash())) {
                return buildTokens(student.getId(), Role.STUDENT, student.getDisplayName());
            }
        }
        throw new BadCredentialsException("Invalid credentials");
    }

    @Transactional(readOnly = true)
    public TokenResponse refresh(String refreshToken) {
        Claims claims;
        try {
            claims = jwtService.parse(refreshToken);
        } catch (Exception ex) {
            throw new BadCredentialsException("Invalid refresh token");
        }
        if (!"refresh".equals(claims.get("type", String.class))) {
            throw new BadCredentialsException("Invalid refresh token");
        }
        UUID id = UUID.fromString(claims.getSubject());
        Role role = Role.valueOf(claims.get("role", String.class));
        if (role == Role.PARENT) {
            Parent parent = parentRepository.findById(id)
                    .filter(Parent::isActive)
                    .orElseThrow(() -> new BadCredentialsException("Account not found"));
            return buildTokens(parent.getId(), Role.PARENT, parent.getName());
        } else {
            Student student = studentRepository.findById(id)
                    .filter(Student::isActive)
                    .orElseThrow(() -> new BadCredentialsException("Account not found"));
            return buildTokens(student.getId(), Role.STUDENT, student.getDisplayName());
        }
    }

    /** Lets the signed-in user (parent or student) change their own password. */
    @Transactional
    public void changePassword(com.mathtutor.auth.security.AuthPrincipal principal,
                               String currentPassword, String newPassword) {
        if (principal.role() == Role.PARENT) {
            Parent parent = parentRepository.findById(principal.id())
                    .orElseThrow(() -> new BadCredentialsException("Account not found"));
            requireMatch(currentPassword, parent.getPasswordHash());
            parent.setPasswordHash(passwordEncoder.encode(newPassword));
            parentRepository.save(parent);
        } else {
            Student student = studentRepository.findById(principal.id())
                    .orElseThrow(() -> new BadCredentialsException("Account not found"));
            requireMatch(currentPassword, student.getPasswordHash());
            student.setPasswordHash(passwordEncoder.encode(newPassword));
            studentRepository.save(student);
        }
    }

    private void requireMatch(String current, String hash) {
        if (!passwordEncoder.matches(current, hash)) {
            throw new com.mathtutor.common.BadRequestException("Your current password is incorrect");
        }
    }

    private TokenResponse buildTokens(UUID id, Role role, String displayName) {
        String access = jwtService.generateAccessToken(id, role, displayName);
        String refresh = jwtService.generateRefreshToken(id, role);
        return new TokenResponse(access, refresh, id, role, displayName);
    }
}
