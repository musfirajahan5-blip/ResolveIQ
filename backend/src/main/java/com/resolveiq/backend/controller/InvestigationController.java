package com.resolveiq.backend.controller;

import com.resolveiq.backend.dto.InvestigationResponse;
import com.resolveiq.backend.service.InvestigationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/investigations")
public class InvestigationController {

    private final InvestigationService investigationService;

    public InvestigationController(InvestigationService investigationService) {
        this.investigationService = investigationService;
    }

    @PostMapping("/ticket/{ticketId}")
    public ResponseEntity<InvestigationResponse> investigateTicket(
            @PathVariable Long ticketId
    ) {
        InvestigationResponse investigation =
                investigationService.investigateTicket(ticketId);

        return ResponseEntity.status(HttpStatus.CREATED).body(investigation);
    }
}
