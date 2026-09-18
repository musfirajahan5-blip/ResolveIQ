package com.resolveiq.backend.dto;

import jakarta.validation.constraints.Size;

/**
 * Optional request body for the resolution endpoints. Every field is optional so
 * the endpoints also work with no body at all. Blank/null fields fall back to
 * sensible defaults inside {@code ResolutionService}.
 */
public record ResolutionRequest(
        @Size(max = 100, message = "performedBy must be at most 100 characters")
        String performedBy,

        @Size(max = 100, message = "assignedTo must be at most 100 characters")
        String assignedTo,

        @Size(max = 1000, message = "notes must be at most 1000 characters")
        String notes
) {
}
