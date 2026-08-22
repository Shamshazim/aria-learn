package com.mathtutor.setup.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class SetupDtos {

    /**
     * Whether the install already has a parent account. The desktop shell polls this on
     * launch to decide between the setup wizard and the sign-in screen.
     */
    public record SetupStatus(boolean configured) {
    }

    /**
     * The only thing a parent is asked for on first run. No email is required — a plain
     * username is friendlier for a family machine — so the value is stored in the
     * parents.email column, which login already searches.
     */
    public record CreateParentRequest(
            @NotBlank
            @Size(min = 3, max = 60, message = "Username must be between 3 and 60 characters")
            String username,

            @NotBlank
            @Size(min = 8, max = 200, message = "Password must be at least 8 characters")
            String password) {
    }
}
