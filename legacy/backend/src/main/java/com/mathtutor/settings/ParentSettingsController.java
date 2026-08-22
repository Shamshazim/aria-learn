package com.mathtutor.settings;

import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.auth.security.SecurityUtils;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/parent/settings")
@PreAuthorize("hasRole('PARENT')")
public class ParentSettingsController {

    private final SettingsService settingsService;

    public ParentSettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public ParentSettings get() {
        AuthPrincipal parent = SecurityUtils.currentPrincipal();
        boolean auto = settingsService.getBool(SettingsService.PARENT, parent.id(),
                SettingsService.KEY_AUTO_ASSIGN_HOMEWORK, true);
        return new ParentSettings(auto);
    }

    @PutMapping
    public ParentSettings update(@RequestBody ParentSettings request) {
        AuthPrincipal parent = SecurityUtils.currentPrincipal();
        settingsService.setBool(SettingsService.PARENT, parent.id(),
                SettingsService.KEY_AUTO_ASSIGN_HOMEWORK, request.autoAssignHomework());
        return request;
    }

    public record ParentSettings(@NotNull Boolean autoAssignHomework) {
    }
}
