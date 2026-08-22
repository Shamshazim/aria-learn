package com.mathtutor.mastery;

import com.mathtutor.mastery.dto.MasteryDtos.MasteryConfigDto;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/mastery-config")
@PreAuthorize("hasRole('PARENT')")
public class MasteryConfigController {

    private final MasteryConfigService service;

    public MasteryConfigController(MasteryConfigService service) {
        this.service = service;
    }

    @GetMapping
    public MasteryConfigDto get() {
        return service.get();
    }

    @PutMapping
    public MasteryConfigDto update(@Valid @RequestBody MasteryConfigDto request) {
        return service.update(request);
    }
}
