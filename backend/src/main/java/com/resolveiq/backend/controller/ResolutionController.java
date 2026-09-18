package com.resolveiq.backend.controller;

import com.resolveiq.backend.dto.ResolutionRequest;
import com.resolveiq.backend.dto.ResolutionResponse;
import com.resolveiq.backend.service.ResolutionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/resolutions")
public class ResolutionController {

    private final ResolutionService resolutionService;

    public ResolutionController(ResolutionService resolutionService) {
        this.resolutionService = resolutionService;
    }

    @PostMapping("/investigation/{investigationId}")
    public ResponseEntity<ResolutionResponse> resolveInvestigation(
            @PathVariable Long investigationId,
            @RequestBody(required = false) @Valid ResolutionRequest request
    ) {
        ResolutionResponse resolution =
                resolutionService.resolveInvestigation(investigationId, request);

        return ResponseEntity.status(HttpStatus.CREATED).body(resolution);
    }

    @PostMapping("/ticket/{ticketId}")
    public ResponseEntity<ResolutionResponse> resolveTicket(
            @PathVariable Long ticketId,
            @RequestBody(required = false) @Valid ResolutionRequest request
    ) {
        ResolutionResponse resolution =
                resolutionService.resolveTicket(ticketId, request);

        return ResponseEntity.status(HttpStatus.CREATED).body(resolution);
    }

    @GetMapping("/investigation/{investigationId}")
    public ResponseEntity<ResolutionResponse> getResolution(
            @PathVariable Long investigationId
    ) {
        return ResponseEntity.ok(
                resolutionService.getResolution(investigationId)
        );
    }
}
