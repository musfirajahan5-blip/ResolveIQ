package com.resolveiq.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ResolutionResponse(
        Long investigationId,
        String investigationCode,
        String decision,
        String outcome,
        String ticketStatus,
        String customerResponse,
        boolean alreadyResolved,
        ActionSummary action,
        EscalationSummary escalation,
        List<RefundSettlement> refundSettlements,
        List<AuditEntry> auditTrail
) {

    public record ActionSummary(
            Long id,
            String actionCode,
            String actionType,
            String status,
            String description,
            String performedBy,
            String result,
            LocalDateTime executedAt
    ) {
    }

    public record EscalationSummary(
            Long id,
            String escalationCode,
            String reason,
            String priority,
            String status,
            String assignedTo,
            String handoffSummary,
            LocalDateTime escalatedAt
    ) {
    }

    public record RefundSettlement(
            Long id,
            String refundCode,
            String paymentCode,
            Double amount,
            String status,
            String refundReference,
            LocalDateTime processedAt,
            boolean newlyCreated
    ) {
    }

    public record AuditEntry(
            Long id,
            String auditCode,
            String eventType,
            String actorType,
            String actorReference,
            String eventDescription,
            LocalDateTime createdAt
    ) {
    }
}
