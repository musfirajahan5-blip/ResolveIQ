package com.resolveiq.backend.service;

import com.resolveiq.backend.dto.ResolutionRequest;
import com.resolveiq.backend.dto.ResolutionResponse;
import com.resolveiq.backend.entity.Action;
import com.resolveiq.backend.entity.AuditLog;
import com.resolveiq.backend.entity.Escalation;
import com.resolveiq.backend.entity.Investigation;
import com.resolveiq.backend.entity.Order;
import com.resolveiq.backend.entity.Payment;
import com.resolveiq.backend.entity.Refund;
import com.resolveiq.backend.entity.SupportTicket;
import com.resolveiq.backend.exception.InvalidResolutionStateException;
import com.resolveiq.backend.exception.ResourceNotFoundException;
import com.resolveiq.backend.repository.ActionRepository;
import com.resolveiq.backend.repository.AuditLogRepository;
import com.resolveiq.backend.repository.EscalationRepository;
import com.resolveiq.backend.repository.InvestigationRepository;
import com.resolveiq.backend.repository.RefundRepository;
import com.resolveiq.backend.repository.SupportTicketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Closes the loop on an {@link Investigation} by acting on its decision: settling
 * real refund rows for an auto-resolve, or raising an escalation for anything that
 * still needs a human. Every outcome is recorded as {@link Action}/{@link Escalation}
 * plus an {@link AuditLog} trail, and re-calling resolve replays the existing
 * outcome without mutating anything.
 */
@Service
public class ResolutionService {

    private static final String REFUND_PENDING = "PENDING";
    private static final String REFUND_PROCESSED = "PROCESSED";
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String STATUS_RESOLVED = "RESOLVED";
    private static final String STATUS_ESCALATED = "ESCALATED";
    private static final String STATUS_OPEN = "OPEN";

    private static final String DEFAULT_SYSTEM_ACTOR = "SYSTEM_AUTO_RESOLVER";
    private static final String MANAGER_QUEUE = "MANAGER_QUEUE";
    private static final String SUPPORT_REVIEW_QUEUE = "SUPPORT_REVIEW_QUEUE";

    private static final String ACTOR_AUTOMATED = "AUTOMATED";
    private static final String ACTOR_SYSTEM = "SYSTEM";

    private static final String OUTCOME_AUTO_RESOLVED = "AUTO_RESOLVED";
    private static final String OUTCOME_ESCALATED = "ESCALATED";

    private final InvestigationRepository investigationRepository;
    private final SupportTicketRepository supportTicketRepository;
    private final ActionRepository actionRepository;
    private final EscalationRepository escalationRepository;
    private final AuditLogRepository auditLogRepository;
    private final RefundRepository refundRepository;
    private final CaseContextService caseContextService;

    public ResolutionService(
            InvestigationRepository investigationRepository,
            SupportTicketRepository supportTicketRepository,
            ActionRepository actionRepository,
            EscalationRepository escalationRepository,
            AuditLogRepository auditLogRepository,
            RefundRepository refundRepository,
            CaseContextService caseContextService
    ) {
        this.investigationRepository = investigationRepository;
        this.supportTicketRepository = supportTicketRepository;
        this.actionRepository = actionRepository;
        this.escalationRepository = escalationRepository;
        this.auditLogRepository = auditLogRepository;
        this.refundRepository = refundRepository;
        this.caseContextService = caseContextService;
    }

    // ---------------------------------------------------------------- entry points

    @Transactional
    public ResolutionResponse resolveInvestigation(Long investigationId, ResolutionRequest request) {
        Investigation investigation = investigationRepository.findById(investigationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Investigation not found with id: " + investigationId));

        return resolve(investigation, request);
    }

    @Transactional
    public ResolutionResponse resolveTicket(Long ticketId, ResolutionRequest request) {
        Investigation investigation = investigationRepository.findByTicketId(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No investigation found for ticket id: " + ticketId));

        return resolve(investigation, request);
    }

    @Transactional(readOnly = true)
    public ResolutionResponse getResolution(Long investigationId) {
        Investigation investigation = investigationRepository.findById(investigationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Investigation not found with id: " + investigationId));

        List<Action> actions =
                actionRepository.findByInvestigationIdOrderByCreatedAtAsc(investigation.getId());
        List<Escalation> escalations =
                escalationRepository.findByInvestigationId(investigation.getId());

        if (actions.isEmpty() && escalations.isEmpty()) {
            throw new ResourceNotFoundException(
                    "No resolution outcome found for investigation id: " + investigationId);
        }

        return buildReplayResponse(investigation, actions, escalations, true);
    }

    // ---------------------------------------------------------------- orchestration

    private ResolutionResponse resolve(Investigation investigation, ResolutionRequest request) {

        if (!STATUS_COMPLETED.equalsIgnoreCase(investigation.getStatus())) {
            throw new InvalidResolutionStateException(
                    "Investigation " + investigation.getInvestigationCode()
                            + " cannot be resolved (current status: "
                            + investigation.getStatus() + ", required: " + STATUS_COMPLETED + ")");
        }

        // Idempotency: a prior outcome is replayed untouched.
        List<Action> existingActions =
                actionRepository.findByInvestigationIdOrderByCreatedAtAsc(investigation.getId());
        List<Escalation> existingEscalations =
                escalationRepository.findByInvestigationId(investigation.getId());

        if (!existingActions.isEmpty() || !existingEscalations.isEmpty()) {
            return buildReplayResponse(investigation, existingActions, existingEscalations, true);
        }

        String performedBy = effectivePerformedBy(request);
        SupportTicket ticket = investigation.getTicket();
        String previousTicketStatus = ticket.getStatus();

        String decision = investigation.getDecision();
        boolean autoResolve = "AUTO_RESOLVE".equalsIgnoreCase(decision);
        String actorType = autoResolve ? ACTOR_AUTOMATED : ACTOR_SYSTEM;

        audit(investigation, null, null, "RESOLUTION_STARTED", actorType, performedBy,
                "Resolution started for investigation " + investigation.getInvestigationCode()
                        + " with decision " + decision + ".");

        if (autoResolve) {
            return executeAutoResolve(
                    investigation, request, performedBy, ticket, previousTicketStatus);
        }

        String defaultQueue = ("MANAGER_APPROVAL_REQUIRED".equalsIgnoreCase(decision)
                || "ESCALATE".equalsIgnoreCase(decision))
                ? MANAGER_QUEUE
                : SUPPORT_REVIEW_QUEUE;

        return executeEscalation(
                investigation, request, performedBy, ticket, previousTicketStatus, defaultQueue);
    }

    // ---------------------------------------------------------------- auto-resolve path

    private ResolutionResponse executeAutoResolve(
            Investigation investigation,
            ResolutionRequest request,
            String performedBy,
            SupportTicket ticket,
            String previousTicketStatus
    ) {

        CaseContextService.OrderContext context = caseContextService.resolveOrderContext(ticket);
        List<CaseContextService.DuplicatePair> duplicates =
                caseContextService.detectDuplicatePayments(context.payments());
        Order order = context.order();

        List<Refund> currentRefunds = order == null
                ? List.of()
                : refundRepository.findByPaymentOrderId(order.getId());

        List<Refund> pendingRefunds = currentRefunds.stream()
                .filter(refund -> REFUND_PENDING.equalsIgnoreCase(refund.getStatus()))
                .toList();

        LocalDateTime now = LocalDateTime.now();
        List<ResolutionResponse.RefundSettlement> settlements = new ArrayList<>();
        List<String> settledCodes = new ArrayList<>();
        double totalSettled = 0.0;

        if (!pendingRefunds.isEmpty()) {
            for (Refund refund : pendingRefunds) {
                refund.setStatus(REFUND_PROCESSED);
                refund.setProcessedAt(now);
                if (refund.getRefundReference() == null || refund.getRefundReference().isBlank()) {
                    refund.setRefundReference(generateRefundReference());
                }
                refundRepository.save(refund);

                settlements.add(toSettlement(refund, false));
                settledCodes.add(refund.getRefundCode());
                totalSettled += refund.getAmount() == null ? 0.0 : refund.getAmount();

                audit(investigation, null, null, "REFUND_SETTLED", ACTOR_AUTOMATED, performedBy,
                        "Refund " + refund.getRefundCode()
                                + " settled to " + REFUND_PROCESSED
                                + " with reference " + refund.getRefundReference() + ".");
            }
        } else if (!duplicates.isEmpty() && order != null) {
            for (CaseContextService.DuplicatePair pair : duplicates) {
                Payment duplicatePayment = pair.duplicate();
                String refundCode = generateRefundCode();
                String refundReference = generateRefundReference();
                Refund refund = new Refund(
                        refundCode,
                        duplicatePayment,
                        duplicatePayment.getAmount(),
                        REFUND_PROCESSED,
                        "Auto-refund for duplicate charge on payment "
                                + duplicatePayment.getPaymentCode() + " (investigation "
                                + investigation.getInvestigationCode() + ", original payment "
                                + pair.original().getPaymentCode() + ")",
                        refundReference,
                        now,
                        now
                );
                refund = refundRepository.save(refund);

                settlements.add(toSettlement(refund, true));
                settledCodes.add(refund.getRefundCode());
                totalSettled += refund.getAmount() == null ? 0.0 : refund.getAmount();

                audit(investigation, null, null, "REFUND_CREATED", ACTOR_AUTOMATED, performedBy,
                        "Refund " + refund.getRefundCode()
                                + " created and processed against payment "
                                + duplicatePayment.getPaymentCode()
                                + " for duplicate of payment "
                                + pair.original().getPaymentCode() + ".");
            }
        }
        // else: no pending refunds and no duplicates -> no financial adjustment required.

        String actionResult = settlements.isEmpty()
                ? "NO_FINANCIAL_ADJUSTMENT_REQUIRED"
                : "SUCCESS";

        String orderCode = order == null ? "(none)" : order.getOrderCode();
        String description;

        if (settlements.isEmpty()) {
            description = "Auto-resolution reviewed order " + orderCode
                    + ": no pending refunds or duplicate charges required settlement.";
        } else {
            description = "Auto-resolved investigation " + investigation.getInvestigationCode()
                    + " by settling refund(s) " + String.join(", ", settledCodes)
                    + " totalling " + amount(totalSettled) + " against order " + orderCode + ".";
        }

        String notes = notes(request);
        if (notes != null) {
            description = description + " Notes: " + notes;
        }

        Action action = new Action(
                generateActionCode(),
                investigation,
                investigation.getRecommendedAction(),
                STATUS_COMPLETED,
                description,
                performedBy,
                actionResult
        );
        action.setExecutedAt(now);
        action = actionRepository.save(action);

        audit(investigation, action, null, "ACTION_EXECUTED", ACTOR_AUTOMATED, performedBy,
                "Action " + action.getActionCode() + " (" + action.getActionType()
                        + ") executed with result " + actionResult + ".");

        ticket.setStatus(STATUS_RESOLVED);
        supportTicketRepository.save(ticket);

        audit(investigation, null, null, "TICKET_STATUS_CHANGED", ACTOR_AUTOMATED, performedBy,
                "Ticket " + ticket.getCaseId() + " status changed from "
                        + previousTicketStatus + " to " + STATUS_RESOLVED + ".");

        String customerResponse = buildCustomerResponse(
                investigation, order, settledCodes, totalSettled, settlements.isEmpty());
        investigation.setCustomerResponse(customerResponse);
        investigationRepository.save(investigation);

        List<AuditLog> auditTrail =
                auditLogRepository.findByInvestigationIdOrderByCreatedAtAsc(investigation.getId());

        return new ResolutionResponse(
                investigation.getId(),
                investigation.getInvestigationCode(),
                investigation.getDecision(),
                OUTCOME_AUTO_RESOLVED,
                ticket.getStatus(),
                investigation.getCustomerResponse(),
                false,
                toActionSummary(action),
                null,
                settlements,
                auditTrail.stream().map(this::toAuditEntry).toList()
        );
    }

    // ---------------------------------------------------------------- escalation path

    private ResolutionResponse executeEscalation(
            Investigation investigation,
            ResolutionRequest request,
            String performedBy,
            SupportTicket ticket,
            String previousTicketStatus,
            String defaultQueue
    ) {

        CaseContextService.OrderContext context = caseContextService.resolveOrderContext(ticket);
        Order order = context.order();

        String assignedTo = effectiveAssignedTo(request, defaultQueue);
        String priority = mapPriority(investigation.getRiskLevel());

        String reason = "Investigation " + investigation.getInvestigationCode()
                + " routed to escalation. Decision: " + investigation.getDecision()
                + ", policy check: " + investigation.getPolicyCheck()
                + ", authorization check: " + investigation.getAuthorizationCheck() + ".";

        String notes = notes(request);
        if (notes != null) {
            reason = reason + " Notes: " + notes;
        }

        String handoffSummary = buildHandoffSummary(investigation, context);

        Escalation escalation = new Escalation(
                generateEscalationCode(),
                investigation,
                reason,
                priority,
                STATUS_OPEN,
                assignedTo,
                handoffSummary
        );
        escalation = escalationRepository.save(escalation);

        audit(investigation, null, escalation, "ESCALATION_CREATED", ACTOR_SYSTEM, performedBy,
                "Escalation " + escalation.getEscalationCode()
                        + " created and assigned to " + assignedTo
                        + " with priority " + priority + ".");

        ticket.setStatus(STATUS_ESCALATED);
        supportTicketRepository.save(ticket);

        audit(investigation, null, null, "TICKET_STATUS_CHANGED", ACTOR_SYSTEM, performedBy,
                "Ticket " + ticket.getCaseId() + " status changed from "
                        + previousTicketStatus + " to " + STATUS_ESCALATED + ".");

        investigation.setEscalationReason(reason);
        investigationRepository.save(investigation);

        List<AuditLog> auditTrail =
                auditLogRepository.findByInvestigationIdOrderByCreatedAtAsc(investigation.getId());

        return new ResolutionResponse(
                investigation.getId(),
                investigation.getInvestigationCode(),
                investigation.getDecision(),
                OUTCOME_ESCALATED,
                ticket.getStatus(),
                investigation.getCustomerResponse(),
                false,
                null,
                toEscalationSummary(escalation),
                List.of(),
                auditTrail.stream().map(this::toAuditEntry).toList()
        );
    }

    // ---------------------------------------------------------------- replay (idempotent / read)

    private ResolutionResponse buildReplayResponse(
            Investigation investigation,
            List<Action> actions,
            List<Escalation> escalations,
            boolean alreadyResolved
    ) {

        Action action = actions.isEmpty() ? null : actions.get(0);
        Escalation escalation = escalations.isEmpty() ? null : escalations.get(0);

        String outcome;
        List<ResolutionResponse.RefundSettlement> settlements;

        if (action != null) {
            outcome = OUTCOME_AUTO_RESOLVED;
            SupportTicket ticket = investigation.getTicket();
            CaseContextService.OrderContext context = caseContextService.resolveOrderContext(ticket);
            Order order = context.order();
            List<Refund> refunds = order == null
                    ? List.of()
                    : refundRepository.findByPaymentOrderId(order.getId());
            settlements = refunds.stream().map(refund -> toSettlement(refund, false)).toList();
        } else {
            outcome = OUTCOME_ESCALATED;
            settlements = List.of();
        }

        List<AuditLog> auditTrail =
                auditLogRepository.findByInvestigationIdOrderByCreatedAtAsc(investigation.getId());

        return new ResolutionResponse(
                investigation.getId(),
                investigation.getInvestigationCode(),
                investigation.getDecision(),
                outcome,
                investigation.getTicket().getStatus(),
                investigation.getCustomerResponse(),
                alreadyResolved,
                action == null ? null : toActionSummary(action),
                escalation == null ? null : toEscalationSummary(escalation),
                settlements,
                auditTrail.stream().map(this::toAuditEntry).toList()
        );
    }

    // ---------------------------------------------------------------- audit + codes

    private AuditLog audit(
            Investigation investigation,
            Action action,
            Escalation escalation,
            String eventType,
            String actorType,
            String actorReference,
            String description
    ) {
        AuditLog log = new AuditLog(
                generateAuditCode(),
                investigation,
                action,
                escalation,
                eventType,
                actorType,
                actorReference,
                description
        );
        return auditLogRepository.save(log);
    }

    private String generateActionCode() {
        String code;
        do {
            code = "ACT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        } while (actionRepository.existsByActionCode(code));
        return code;
    }

    private String generateEscalationCode() {
        String code;
        do {
            code = "ESC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        } while (escalationRepository.existsByEscalationCode(code));
        return code;
    }

    private String generateAuditCode() {
        String code;
        do {
            code = "AUD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        } while (auditLogRepository.existsByAuditCode(code));
        return code;
    }

    private String generateRefundCode() {
        String code;
        do {
            code = "RFD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        } while (refundRepository.existsByRefundCode(code));
        return code;
    }

    private String generateRefundReference() {
        return "RFND-AUTO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    // ---------------------------------------------------------------- mapping + helpers

    private ResolutionResponse.ActionSummary toActionSummary(Action action) {
        return new ResolutionResponse.ActionSummary(
                action.getId(),
                action.getActionCode(),
                action.getActionType(),
                action.getStatus(),
                action.getDescription(),
                action.getPerformedBy(),
                action.getResult(),
                action.getExecutedAt()
        );
    }

    private ResolutionResponse.EscalationSummary toEscalationSummary(Escalation escalation) {
        return new ResolutionResponse.EscalationSummary(
                escalation.getId(),
                escalation.getEscalationCode(),
                escalation.getReason(),
                escalation.getPriority(),
                escalation.getStatus(),
                escalation.getAssignedTo(),
                escalation.getHandoffSummary(),
                escalation.getEscalatedAt()
        );
    }

    private ResolutionResponse.RefundSettlement toSettlement(Refund refund, boolean newlyCreated) {
        return new ResolutionResponse.RefundSettlement(
                refund.getId(),
                refund.getRefundCode(),
                refund.getPayment().getPaymentCode(),
                refund.getAmount(),
                refund.getStatus(),
                refund.getRefundReference(),
                refund.getProcessedAt(),
                newlyCreated
        );
    }

    private ResolutionResponse.AuditEntry toAuditEntry(AuditLog log) {
        return new ResolutionResponse.AuditEntry(
                log.getId(),
                log.getAuditCode(),
                log.getEventType(),
                log.getActorType(),
                log.getActorReference(),
                log.getEventDescription(),
                log.getCreatedAt()
        );
    }

    private String mapPriority(String riskLevel) {
        if (riskLevel == null) {
            return "MEDIUM";
        }
        return switch (riskLevel.toUpperCase(Locale.ROOT)) {
            case "HIGH" -> "HIGH";
            case "LOW" -> "LOW";
            default -> "MEDIUM";
        };
    }

    private String buildHandoffSummary(Investigation investigation, CaseContextService.OrderContext context) {
        StringBuilder summary = new StringBuilder()
                .append("Investigation ").append(investigation.getInvestigationCode())
                .append(" requires manual handling. Root cause: ")
                .append(investigation.getRootCause())
                .append(". Intent: ").append(investigation.getIntent())
                .append(". Confidence: ").append(investigation.getConfidence())
                .append(". Risk level: ").append(investigation.getRiskLevel())
                .append(".");

        Order order = context.order();
        if (order != null) {
            summary.append(" Order: ").append(order.getOrderCode()).append(".");
            List<String> paymentCodes = context.payments().stream()
                    .map(Payment::getPaymentCode)
                    .toList();
            if (!paymentCodes.isEmpty()) {
                summary.append(" Payments: ").append(String.join(", ", paymentCodes)).append(".");
            }
        }

        return summary.toString();
    }

    private String buildCustomerResponse(
            Investigation investigation,
            Order order,
            List<String> settledCodes,
            double totalSettled,
            boolean noAdjustment
    ) {
        String orderCode = order == null ? "on file" : order.getOrderCode();

        if (noAdjustment) {
            return "Investigation " + investigation.getInvestigationCode()
                    + " has been reviewed. No financial adjustment was required for order "
                    + orderCode + ".";
        }

        return "Your case " + investigation.getInvestigationCode()
                + " has been resolved. Refund(s) " + String.join(", ", settledCodes)
                + " totalling " + amount(totalSettled)
                + " have been processed for order " + orderCode + ".";
    }

    private String effectivePerformedBy(ResolutionRequest request) {
        if (request != null && request.performedBy() != null && !request.performedBy().isBlank()) {
            return request.performedBy().trim();
        }
        return DEFAULT_SYSTEM_ACTOR;
    }

    private String effectiveAssignedTo(ResolutionRequest request, String defaultQueue) {
        if (request != null && request.assignedTo() != null && !request.assignedTo().isBlank()) {
            return request.assignedTo().trim();
        }
        return defaultQueue;
    }

    private String notes(ResolutionRequest request) {
        if (request != null && request.notes() != null && !request.notes().isBlank()) {
            return request.notes().trim();
        }
        return null;
    }

    private String amount(double value) {
        return String.format(Locale.ROOT, "%.2f", value);
    }
}
