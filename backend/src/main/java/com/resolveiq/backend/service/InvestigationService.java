package com.resolveiq.backend.service;

import com.resolveiq.backend.dto.InvestigationResponse;
import com.resolveiq.backend.entity.Conversation;
import com.resolveiq.backend.entity.Customer;
import com.resolveiq.backend.entity.Evidence;
import com.resolveiq.backend.entity.Investigation;
import com.resolveiq.backend.entity.Order;
import com.resolveiq.backend.entity.Payment;
import com.resolveiq.backend.entity.Refund;
import com.resolveiq.backend.entity.SupportPolicy;
import com.resolveiq.backend.entity.SupportTicket;
import com.resolveiq.backend.exception.ResourceNotFoundException;
import com.resolveiq.backend.repository.ConversationRepository;
import com.resolveiq.backend.repository.EvidenceRepository;
import com.resolveiq.backend.repository.InvestigationRepository;
import com.resolveiq.backend.repository.RefundRepository;
import com.resolveiq.backend.repository.SupportPolicyRepository;
import com.resolveiq.backend.repository.SupportTicketRepository;
import com.resolveiq.backend.service.CaseContextService.DuplicatePair;
import com.resolveiq.backend.service.CaseContextService.OrderContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class InvestigationService {

    private static final String REFUND_PENDING = "PENDING";
    private static final String POLICY_ACTIVE = "ACTIVE";
    private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final SupportTicketRepository supportTicketRepository;
    private final RefundRepository refundRepository;
    private final ConversationRepository conversationRepository;
    private final SupportPolicyRepository supportPolicyRepository;
    private final InvestigationRepository investigationRepository;
    private final EvidenceRepository evidenceRepository;
    private final CaseContextService caseContextService;

    public InvestigationService(
            SupportTicketRepository supportTicketRepository,
            RefundRepository refundRepository,
            ConversationRepository conversationRepository,
            SupportPolicyRepository supportPolicyRepository,
            InvestigationRepository investigationRepository,
            EvidenceRepository evidenceRepository,
            CaseContextService caseContextService
    ) {
        this.supportTicketRepository = supportTicketRepository;
        this.refundRepository = refundRepository;
        this.conversationRepository = conversationRepository;
        this.supportPolicyRepository = supportPolicyRepository;
        this.investigationRepository = investigationRepository;
        this.evidenceRepository = evidenceRepository;
        this.caseContextService = caseContextService;
    }

    @Transactional
    public InvestigationResponse investigateTicket(Long ticketId) {

        SupportTicket ticket = supportTicketRepository.findById(ticketId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Support ticket not found with id: " + ticketId));

        OrderContext context = caseContextService.resolveOrderContext(ticket);

        List<DuplicatePair> duplicates = caseContextService.detectDuplicatePayments(context.payments());

        List<Refund> refunds = context.order() == null
                ? List.of()
                : refundRepository.findByPaymentOrderId(context.order().getId());

        List<Refund> pendingRefunds = refunds.stream()
                .filter(refund -> REFUND_PENDING.equalsIgnoreCase(refund.getStatus()))
                .toList();

        List<Conversation> conversations =
                conversationRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);

        Assessment assessment = assess(ticket, context, duplicates, pendingRefunds);

        Investigation investigation = investigationRepository.findByTicketId(ticketId)
                .orElseGet(() -> new Investigation(generateInvestigationCode(), ticket, "IN_PROGRESS"));

        applyAssessment(investigation, assessment);
        Investigation saved = investigationRepository.save(investigation);

        // startedAt is populated by @PrePersist during save, so stamp completion after it.
        saved.setCompletedAt(LocalDateTime.now());

        List<Evidence> evidence = rebuildEvidence(
                saved, ticket, context, duplicates, refunds, conversations, assessment);

        return toResponse(saved, ticket, context, duplicates, pendingRefunds, evidence, assessment);
    }

    // ---------------------------------------------------------------- analysis

    private Assessment assess(
            SupportTicket ticket,
            OrderContext context,
            List<DuplicatePair> duplicates,
            List<Refund> pendingRefunds
    ) {

        boolean hasDuplicates = !duplicates.isEmpty();
        boolean hasPendingRefunds = !pendingRefunds.isEmpty();

        double disputedAmount = hasDuplicates
                ? duplicates.stream().mapToDouble(pair -> pair.duplicate().getAmount()).sum()
                : pendingRefunds.stream().mapToDouble(Refund::getAmount).sum();

        String category = hasDuplicates ? "PAYMENT" : normalizedCategory(ticket);
        SupportPolicy policy = resolvePolicy(category, disputedAmount);
        boolean autoResolutionAllowed = allowsAutoResolution(policy, disputedAmount);

        String policyCheck;
        String authorizationCheck;
        String decision;

        if (!hasDuplicates && !hasPendingRefunds) {
            policyCheck = "NOT_EVALUATED";
            authorizationCheck = "NOT_APPLICABLE";
            decision = context.order() == null ? "NEEDS_MORE_INFORMATION" : "MANUAL_REVIEW";
        } else if (policy == null) {
            policyCheck = "NO_MATCHING_POLICY (" + category + ")";
            authorizationCheck = "MANAGER_APPROVAL_REQUIRED";
            decision = "MANAGER_APPROVAL_REQUIRED";
        } else if (autoResolutionAllowed) {
            policyCheck = "PASS (" + policy.getPolicyCode() + ")";
            authorizationCheck = "AUTO_APPROVED";
            decision = "AUTO_RESOLVE";
        } else {
            policyCheck = "REVIEW_REQUIRED (" + policy.getPolicyCode() + ")";
            authorizationCheck = "MANAGER_APPROVAL_REQUIRED";
            decision = "MANAGER_APPROVAL_REQUIRED";
        }

        return new Assessment(
                resolveIntent(ticket, hasDuplicates),
                buildRootCause(ticket, context, duplicates, pendingRefunds),
                resolveConfidence(context, hasDuplicates, hasPendingRefunds),
                resolveRiskLevel(disputedAmount, hasDuplicates, hasPendingRefunds),
                policy,
                policyCheck,
                authorizationCheck,
                resolveRecommendedAction(context, hasDuplicates, hasPendingRefunds),
                decision,
                disputedAmount
        );
    }

    private String resolveIntent(SupportTicket ticket, boolean hasDuplicates) {

        String text = (ticket.getSubject() + " " + ticket.getDescription()).toLowerCase(Locale.ROOT);

        if (text.contains("duplicate") || text.contains("charged twice")
                || text.contains("double charge") || text.contains("twice")) {
            return "DUPLICATE_PAYMENT_DISPUTE";
        }

        if (text.contains("refund") || text.contains("money back") || text.contains("reimburse")) {
            return "REFUND_REQUEST";
        }

        if (text.contains("not delivered") || text.contains("delivery")
                || text.contains("shipping") || text.contains("lost package")) {
            return "DELIVERY_ISSUE";
        }

        if (text.contains("cancel")) {
            return "CANCELLATION_REQUEST";
        }

        if (text.contains("damaged") || text.contains("broken") || text.contains("defective")) {
            return "PRODUCT_DAMAGE_CLAIM";
        }

        return hasDuplicates ? "DUPLICATE_PAYMENT_DISPUTE" : "GENERAL_SUPPORT";
    }

    private String buildRootCause(
            SupportTicket ticket,
            OrderContext context,
            List<DuplicatePair> duplicates,
            List<Refund> pendingRefunds
    ) {

        if (context.order() == null) {
            String reference = ticket.getOrderReference();
            return "No order record could be matched for ticket " + ticket.getCaseId()
                    + ". Ticket order reference: "
                    + (reference == null || reference.isBlank() ? "none provided" : reference)
                    + ". Payment history could not be verified without an order.";
        }

        Order order = context.order();
        StringBuilder rootCause = new StringBuilder();

        if (!duplicates.isEmpty()) {
            DuplicatePair pair = duplicates.get(0);

            rootCause.append("Customer was charged ")
                    .append(duplicates.size() + 1)
                    .append(" times for order ").append(order.getOrderCode())
                    .append(". Payment ").append(pair.duplicate().getPaymentCode())
                    .append(" of ").append(amount(pair.duplicate().getAmount()))
                    .append(" was captured ").append(pair.minutesApart())
                    .append(" minute(s) after payment ").append(pair.original().getPaymentCode())
                    .append(" for the same amount, which indicates a duplicate charge.");
        }

        if (!pendingRefunds.isEmpty()) {
            Refund refund = pendingRefunds.get(0);

            if (!rootCause.isEmpty()) {
                rootCause.append(" ");
            }

            rootCause.append("Refund ").append(refund.getRefundCode())
                    .append(" of ").append(amount(refund.getAmount()))
                    .append(" against payment ").append(refund.getPayment().getPaymentCode())
                    .append(" has been PENDING since ").append(timestamp(refund.getRequestedAt()))
                    .append(", so the customer has not been reimbursed yet.");
        }

        if (rootCause.isEmpty()) {
            rootCause.append("Order ").append(order.getOrderCode())
                    .append(" has ").append(context.payments().size())
                    .append(" payment record(s) with no duplicate charges and no pending refunds detected.");
        }

        return rootCause.toString();
    }

    private double resolveConfidence(
            OrderContext context,
            boolean hasDuplicates,
            boolean hasPendingRefunds
    ) {
        if (context.order() == null) {
            return 0.20;
        }
        if (hasDuplicates && hasPendingRefunds) {
            return 0.95;
        }
        if (hasDuplicates) {
            return 0.90;
        }
        if (hasPendingRefunds) {
            return 0.75;
        }
        return 0.45;
    }

    private String resolveRiskLevel(
            double disputedAmount,
            boolean hasDuplicates,
            boolean hasPendingRefunds
    ) {
        if (!hasDuplicates && !hasPendingRefunds) {
            return "LOW";
        }
        return disputedAmount >= 500.00 ? "HIGH" : "MEDIUM";
    }

    private String resolveRecommendedAction(
            OrderContext context,
            boolean hasDuplicates,
            boolean hasPendingRefunds
    ) {
        if (hasDuplicates && hasPendingRefunds) {
            return "EXPEDITE_PENDING_REFUND";
        }
        if (hasDuplicates) {
            return "INITIATE_DUPLICATE_PAYMENT_REFUND";
        }
        if (hasPendingRefunds) {
            return "FOLLOW_UP_PENDING_REFUND";
        }
        return context.order() == null ? "REQUEST_ORDER_DETAILS" : "MANUAL_REVIEW";
    }

    private String normalizedCategory(SupportTicket ticket) {
        return ticket.getCategory() == null
                ? ""
                : ticket.getCategory().trim().toUpperCase(Locale.ROOT);
    }

    /**
     * Prefers an active policy that authorises auto-resolution for this amount and falls
     * back to the first active policy for the category, which then requires review.
     */
    private SupportPolicy resolvePolicy(String category, double amount) {

        List<SupportPolicy> policies =
                supportPolicyRepository.findByCategoryAndStatus(category, POLICY_ACTIVE);

        return policies.stream()
                .filter(policy -> allowsAutoResolution(policy, amount))
                .findFirst()
                .orElseGet(() -> policies.stream().findFirst().orElse(null));
    }

    private boolean allowsAutoResolution(SupportPolicy policy, double amount) {
        return policy != null
                && Boolean.TRUE.equals(policy.getAutoResolutionAllowed())
                && !Boolean.TRUE.equals(policy.getManagerApprovalRequired())
                && policy.getMaximumAutoRefundAmount() != null
                && amount > 0
                && amount <= policy.getMaximumAutoRefundAmount();
    }

    private void applyAssessment(Investigation investigation, Assessment assessment) {
        investigation.setIntent(assessment.intent());
        investigation.setRootCause(assessment.rootCause());
        investigation.setConfidence(assessment.confidence());
        investigation.setRiskLevel(assessment.riskLevel());
        investigation.setPolicyCheck(assessment.policyCheck());
        investigation.setAuthorizationCheck(assessment.authorizationCheck());
        investigation.setRecommendedAction(assessment.recommendedAction());
        investigation.setDecision(assessment.decision());
        investigation.setStatus("COMPLETED");
    }

    // ---------------------------------------------------------------- evidence

    private List<Evidence> rebuildEvidence(
            Investigation investigation,
            SupportTicket ticket,
            OrderContext context,
            List<DuplicatePair> duplicates,
            List<Refund> refunds,
            List<Conversation> conversations,
            Assessment assessment
    ) {

        List<Evidence> previous = evidenceRepository.findByInvestigationId(investigation.getId());

        if (!previous.isEmpty()) {
            evidenceRepository.deleteAll(previous);
        }

        List<Evidence> evidence = new ArrayList<>();

        evidence.add(evidence(investigation, "TICKET", "SUPPORT_TICKET", ticket.getCaseId(),
                "Ticket " + ticket.getCaseId() + " (" + ticket.getCategory() + ") raised with subject \""
                        + ticket.getSubject() + "\": " + ticket.getDescription(),
                "HIGH"));

        Customer customer = ticket.getCustomer();
        evidence.add(evidence(investigation, "CUSTOMER", "CUSTOMER_RECORD", customer.getCustomerCode(),
                "Customer " + customer.getName() + " (" + customer.getCustomerCode() + "), account status "
                        + customer.getStatus() + ", contact " + customer.getEmail() + ".",
                "MEDIUM"));

        if (context.order() == null) {
            String reference = ticket.getOrderReference();
            evidence.add(evidence(investigation, "ORDER", "ORDER_RECORD", reference,
                    "No order record matched ticket reference "
                            + (reference == null || reference.isBlank() ? "(none provided)" : reference)
                            + " and the customer has no orders on file.",
                    "HIGH"));
        } else {
            Order order = context.order();
            evidence.add(evidence(investigation, "ORDER", "ORDER_RECORD", order.getOrderCode(),
                    "Order " + order.getOrderCode() + " for " + order.getQuantity() + " x "
                            + order.getProduct().getName() + ", total " + amount(order.getTotalAmount())
                            + ", status " + order.getStatus() + ", placed " + timestamp(order.getOrderDate())
                            + ". " + (context.linkedByReference()
                                    ? "Matched directly from the ticket order reference."
                                    : "Inferred as the customer's most recent order."),
                    "HIGH"));
        }

        List<String> duplicatePaymentCodes = duplicates.stream()
                .flatMap(pair -> List.of(
                        pair.original().getPaymentCode(),
                        pair.duplicate().getPaymentCode()).stream())
                .toList();

        for (Payment payment : context.payments()) {
            evidence.add(evidence(investigation, "PAYMENT", "PAYMENT_RECORD", payment.getPaymentCode(),
                    "Payment " + payment.getPaymentCode() + " of " + amount(payment.getAmount())
                            + " via " + payment.getPaymentMethod() + ", status " + payment.getStatus()
                            + ", transaction " + payment.getTransactionReference()
                            + ", captured " + timestamp(payment.getPaymentDate()) + ".",
                    duplicatePaymentCodes.contains(payment.getPaymentCode()) ? "CRITICAL" : "MEDIUM"));
        }

        for (DuplicatePair pair : duplicates) {
            evidence.add(evidence(investigation, "DUPLICATE_PAYMENT", "PAYMENT_RECORD",
                    pair.duplicate().getPaymentCode(),
                    "Duplicate charge detected: payment " + pair.duplicate().getPaymentCode()
                            + " (" + amount(pair.duplicate().getAmount()) + ", transaction "
                            + pair.duplicate().getTransactionReference() + ") was captured "
                            + pair.minutesApart() + " minute(s) after payment "
                            + pair.original().getPaymentCode() + " (" + amount(pair.original().getAmount())
                            + ", transaction " + pair.original().getTransactionReference()
                            + ") for the same order and amount.",
                    "CRITICAL"));
        }

        for (Refund refund : refunds) {
            boolean pending = REFUND_PENDING.equalsIgnoreCase(refund.getStatus());

            evidence.add(evidence(investigation,
                    pending ? "PENDING_REFUND" : "REFUND", "REFUND_RECORD", refund.getRefundCode(),
                    "Refund " + refund.getRefundCode() + " of " + amount(refund.getAmount())
                            + " against payment " + refund.getPayment().getPaymentCode()
                            + " is " + refund.getStatus() + ", requested " + timestamp(refund.getRequestedAt())
                            + (refund.getProcessedAt() == null
                                    ? " and not yet processed"
                                    : " and processed " + timestamp(refund.getProcessedAt()))
                            + ". Reason: " + refund.getReason(),
                    pending ? "CRITICAL" : "LOW"));
        }

        for (Conversation conversation : conversations) {
            evidence.add(evidence(investigation, "CONVERSATION", "CONVERSATION_MESSAGE",
                    "MSG-" + conversation.getId(),
                    conversation.getSenderType() + " at " + timestamp(conversation.getCreatedAt())
                            + ": " + conversation.getMessage(),
                    "MEDIUM"));
        }

        SupportPolicy policy = assessment.policy();

        if (policy != null) {
            evidence.add(evidence(investigation, "POLICY", "SUPPORT_POLICY", policy.getPolicyCode(),
                    "Policy " + policy.getPolicyCode() + " - " + policy.getPolicyName() + ": "
                            + policy.getDescription() + " Auto-resolution allowed: "
                            + policy.getAutoResolutionAllowed() + ", manager approval required: "
                            + policy.getManagerApprovalRequired() + ", maximum auto refund: "
                            + amount(policy.getMaximumAutoRefundAmount()) + ".",
                    "HIGH"));
        }

        return evidenceRepository.saveAll(evidence);
    }

    private Evidence evidence(
            Investigation investigation,
            String evidenceType,
            String sourceType,
            String sourceReference,
            String description,
            String relevance
    ) {
        return new Evidence(
                generateEvidenceCode(),
                investigation,
                evidenceType,
                sourceType,
                sourceReference,
                description,
                relevance
        );
    }

    // ---------------------------------------------------------------- response mapping

    private InvestigationResponse toResponse(
            Investigation investigation,
            SupportTicket ticket,
            OrderContext context,
            List<DuplicatePair> duplicates,
            List<Refund> pendingRefunds,
            List<Evidence> evidence,
            Assessment assessment
    ) {

        Customer customer = ticket.getCustomer();
        Order order = context.order();

        InvestigationResponse.Findings findings = new InvestigationResponse.Findings(
                !duplicates.isEmpty(),
                duplicates.stream()
                        .map(pair -> new InvestigationResponse.DuplicatePaymentFinding(
                                pair.duplicate().getAmount(),
                                toPaymentSummary(pair.original()),
                                toPaymentSummary(pair.duplicate()),
                                pair.minutesApart()))
                        .toList(),
                !pendingRefunds.isEmpty(),
                pendingRefunds.stream().map(this::toRefundSummary).toList(),
                assessment.disputedAmount()
        );

        return new InvestigationResponse(
                investigation.getId(),
                investigation.getInvestigationCode(),
                investigation.getStatus(),
                investigation.getIntent(),
                investigation.getSentiment(),
                investigation.getRootCause(),
                investigation.getConfidence(),
                investigation.getRiskLevel(),
                investigation.getPolicyCheck(),
                investigation.getAuthorizationCheck(),
                investigation.getRecommendedAction(),
                investigation.getDecision(),
                investigation.getStartedAt(),
                investigation.getCompletedAt(),
                new InvestigationResponse.TicketSummary(
                        ticket.getId(),
                        ticket.getCaseId(),
                        ticket.getCategory(),
                        ticket.getOrderReference(),
                        ticket.getSubject(),
                        ticket.getDescription(),
                        ticket.getStatus()),
                new InvestigationResponse.CustomerSummary(
                        customer.getId(),
                        customer.getCustomerCode(),
                        customer.getName(),
                        customer.getEmail(),
                        customer.getStatus()),
                order == null ? null : new InvestigationResponse.OrderSummary(
                        order.getId(),
                        order.getOrderCode(),
                        order.getProduct().getName(),
                        order.getQuantity(),
                        order.getTotalAmount(),
                        order.getStatus(),
                        order.getOrderDate(),
                        context.linkedByReference()),
                findings,
                evidence.stream()
                        .map(item -> new InvestigationResponse.EvidenceItem(
                                item.getId(),
                                item.getEvidenceCode(),
                                item.getEvidenceType(),
                                item.getSourceType(),
                                item.getSourceReference(),
                                item.getDescription(),
                                item.getRelevance()))
                        .toList()
        );
    }

    private InvestigationResponse.PaymentSummary toPaymentSummary(Payment payment) {
        return new InvestigationResponse.PaymentSummary(
                payment.getId(),
                payment.getPaymentCode(),
                payment.getAmount(),
                payment.getPaymentMethod(),
                payment.getStatus(),
                payment.getTransactionReference(),
                payment.getPaymentDate()
        );
    }

    private InvestigationResponse.RefundSummary toRefundSummary(Refund refund) {
        return new InvestigationResponse.RefundSummary(
                refund.getId(),
                refund.getRefundCode(),
                refund.getPayment().getPaymentCode(),
                refund.getAmount(),
                refund.getStatus(),
                refund.getReason(),
                refund.getRequestedAt(),
                refund.getProcessedAt()
        );
    }

    // ---------------------------------------------------------------- helpers

    private String generateInvestigationCode() {
        String code;

        do {
            code = "INV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        } while (investigationRepository.existsByInvestigationCode(code));

        return code;
    }

    private String generateEvidenceCode() {
        String code;

        do {
            code = "EV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        } while (evidenceRepository.existsByEvidenceCode(code));

        return code;
    }

    private String amount(Double value) {
        return value == null ? "n/a" : String.format(Locale.ROOT, "%.2f", value);
    }

    private String timestamp(LocalDateTime value) {
        return value == null ? "unknown" : TIMESTAMP.format(value);
    }

    private record Assessment(
            String intent,
            String rootCause,
            double confidence,
            String riskLevel,
            SupportPolicy policy,
            String policyCheck,
            String authorizationCheck,
            String recommendedAction,
            String decision,
            double disputedAmount
    ) {
    }
}
