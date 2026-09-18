package com.resolveiq.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public record InvestigationResponse(
        Long id,
        String investigationCode,
        String status,
        String intent,
        String sentiment,
        String rootCause,
        Double confidence,
        String riskLevel,
        String policyCheck,
        String authorizationCheck,
        String recommendedAction,
        String decision,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        TicketSummary ticket,
        CustomerSummary customer,
        OrderSummary order,
        Findings findings,
        List<EvidenceItem> evidence
) {

    public record TicketSummary(
            Long id,
            String caseId,
            String category,
            String orderReference,
            String subject,
            String description,
            String status
    ) {
    }

    public record CustomerSummary(
            Long id,
            String customerCode,
            String name,
            String email,
            String status
    ) {
    }

    public record OrderSummary(
            Long id,
            String orderCode,
            String productName,
            Integer quantity,
            Double totalAmount,
            String status,
            LocalDateTime orderDate,
            boolean linkedByTicketReference
    ) {
    }

    public record PaymentSummary(
            Long id,
            String paymentCode,
            Double amount,
            String paymentMethod,
            String status,
            String transactionReference,
            LocalDateTime paymentDate
    ) {
    }

    public record RefundSummary(
            Long id,
            String refundCode,
            String paymentCode,
            Double amount,
            String status,
            String reason,
            LocalDateTime requestedAt,
            LocalDateTime processedAt
    ) {
    }

    public record DuplicatePaymentFinding(
            Double amount,
            PaymentSummary originalPayment,
            PaymentSummary duplicatePayment,
            Long minutesApart
    ) {
    }

    public record Findings(
            boolean duplicatePaymentDetected,
            List<DuplicatePaymentFinding> duplicatePayments,
            boolean pendingRefundDetected,
            List<RefundSummary> pendingRefunds,
            Double disputedAmount
    ) {
    }

    public record EvidenceItem(
            Long id,
            String evidenceCode,
            String evidenceType,
            String sourceType,
            String sourceReference,
            String description,
            String relevance
    ) {
    }
}
