package com.mathtutor.auth;

import com.mathtutor.auth.dto.AuthDtos.ChangePasswordRequest;
import com.mathtutor.auth.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

/** Account self-service for the signed-in user (parent OR student). */
@RestController
@RequestMapping("/api/v1/account")
public class AccountController {

    private final AuthService authService;

    public AccountController(AuthService authService) {
        this.authService = authService;
    }

    /** Change your own password (requires your current password). */
    @PostMapping("/change-password")
    public void changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(SecurityUtils.currentPrincipal(),
                request.currentPassword(), request.newPassword());
    }
}
