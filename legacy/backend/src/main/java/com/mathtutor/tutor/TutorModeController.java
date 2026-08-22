package com.mathtutor.tutor;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Exposes the selectable tutor personalities to the parent portal. */
@RestController
@RequestMapping("/api/v1/tutor-modes")
@PreAuthorize("hasRole('PARENT')")
public class TutorModeController {

    private final TutorModeService tutorModeService;

    public TutorModeController(TutorModeService tutorModeService) {
        this.tutorModeService = tutorModeService;
    }

    public record TutorModeDto(String code, String name, String emoji, String description) {}

    @GetMapping
    public List<TutorModeDto> list() {
        return tutorModeService.listActive().stream()
                .map(m -> new TutorModeDto(m.getCode(), m.getName(), m.getEmoji(), m.getDescription()))
                .toList();
    }
}
