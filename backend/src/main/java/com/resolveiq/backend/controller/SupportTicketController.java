package com.resolveiq.backend.controller;

import com.resolveiq.backend.dto.CreateTicketRequest;
import com.resolveiq.backend.entity.SupportTicket;
import com.resolveiq.backend.service.SupportTicketService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tickets")
public class SupportTicketController {

    private final SupportTicketService supportTicketService;

    public SupportTicketController(SupportTicketService supportTicketService) {
        this.supportTicketService = supportTicketService;
    }

    @GetMapping
    public ResponseEntity<List<SupportTicket>> getAllTickets() {
        return ResponseEntity.ok(supportTicketService.getAllTickets());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SupportTicket> getTicketById(@PathVariable Long id) {
        return ResponseEntity.ok(
                supportTicketService.getTicketById(id)
        );
    }

    @GetMapping("/case/{caseId}")
    public ResponseEntity<SupportTicket> getTicketByCaseId(
            @PathVariable String caseId
    ) {
        return ResponseEntity.ok(
                supportTicketService.getTicketByCaseId(caseId)
        );
    }

    @PostMapping
    public ResponseEntity<SupportTicket> createTicket(
            @Valid @RequestBody CreateTicketRequest request
    ) {
        SupportTicket ticket = supportTicketService.createTicket(
                request.getCustomerId(),
                request.getCategory(),
                request.getOrderReference(),
                request.getSubject(),
                request.getDescription()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(ticket);
    }
}