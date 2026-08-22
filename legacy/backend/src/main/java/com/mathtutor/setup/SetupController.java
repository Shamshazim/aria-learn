package com.mathtutor.setup;

import com.mathtutor.auth.dto.AuthDtos.TokenResponse;
import com.mathtutor.setup.dto.SetupDtos.CreateParentRequest;
import com.mathtutor.setup.dto.SetupDtos.SetupStatus;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * First-run setup. Unauthenticated by necessity — there is no account yet — and safe
 * because {@link SetupService} refuses once one exists.
 */
@RestController
@RequestMapping("/api/v1/setup")
public class SetupController {

    private final SetupService setupService;

    public SetupController(SetupService setupService) {
        this.setupService = setupService;
    }

    @GetMapping("/status")
    public SetupStatus status() {
        return new SetupStatus(setupService.isConfigured());
    }

    @PostMapping("/parent")
    public TokenResponse createParent(@Valid @RequestBody CreateParentRequest request) {
        return setupService.createFirstParent(request);
    }
}
