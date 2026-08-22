package com.mathtutor.setup;

import com.mathtutor.auth.Parent;
import com.mathtutor.auth.ParentRepository;
import com.mathtutor.auth.Role;
import com.mathtutor.auth.dto.AuthDtos.TokenResponse;
import com.mathtutor.auth.security.JwtService;
import com.mathtutor.common.BadRequestException;
import com.mathtutor.common.ForbiddenException;
import com.mathtutor.setup.dto.SetupDtos.CreateParentRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns the one-time creation of the first parent account.
 *
 * The desktop build ships with an empty database and no seeded credentials, so this is how
 * an install gets its first user. That makes it the one unauthenticated write in the API,
 * which is why it closes permanently the moment a parent exists: after first run the
 * endpoint can only ever refuse. Every later account is created by a signed-in parent
 * through the existing student/parent endpoints.
 */
@Service
public class SetupService {

    private static final Logger log = LoggerFactory.getLogger(SetupService.class);

    private final ParentRepository parentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public SetupService(ParentRepository parentRepository,
                        PasswordEncoder passwordEncoder,
                        JwtService jwtService) {
        this.parentRepository = parentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public boolean isConfigured() {
        return parentRepository.count() > 0;
    }

    /**
     * Creates the first parent and signs them straight in, so the wizard is genuinely
     * "username, password, done" rather than making the parent log in again immediately.
     *
     * <p>Synchronized because the guard is a read-then-write: two simultaneous requests
     * that both saw an empty table would otherwise both create an account, and the unique
     * index on email would not catch it because the usernames differ.
     */
    @Transactional
    public synchronized TokenResponse createFirstParent(CreateParentRequest req) {
        if (parentRepository.count() > 0) {
            throw new ForbiddenException("This installation already has a parent account. Please sign in instead.");
        }

        String username = req.username().trim();
        if (username.chars().anyMatch(Character::isWhitespace)) {
            throw new BadRequestException("Username cannot contain spaces");
        }

        Parent parent = new Parent();
        parent.setEmail(username);
        parent.setName(username);
        parent.setPasswordHash(passwordEncoder.encode(req.password()));
        parentRepository.save(parent);

        log.info("First parent account created; setup endpoint is now closed");
        return new TokenResponse(
                jwtService.generateAccessToken(parent.getId(), Role.PARENT, parent.getName()),
                jwtService.generateRefreshToken(parent.getId(), Role.PARENT),
                parent.getId(),
                Role.PARENT,
                parent.getName());
    }
}
