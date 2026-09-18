package com.resolveiq.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "investigations")
public class Investigation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String investigationCode;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_id", nullable = false, unique = true)
    private SupportTicket ticket;

    private String status;

    private String intent;

    private String sentiment;

    @Column(columnDefinition = "TEXT")
    private String rootCause;

    private Double confidence;

    private String riskLevel;

    private String policyCheck;

    private String authorizationCheck;

    private String recommendedAction;

    private String decision;

    @Column(columnDefinition = "TEXT")
    private String customerResponse;

    @Column(columnDefinition = "TEXT")
    private String escalationReason;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();

        if (startedAt == null) {
            startedAt = LocalDateTime.now();
        }

        if (status == null || status.isBlank()) {
            status = "PENDING";
        }
    }

    public Investigation() {
    }

    public Investigation(
            String investigationCode,
            SupportTicket ticket,
            String status
    ) {
        this.investigationCode = investigationCode;
        this.ticket = ticket;
        this.status = status;
    }

    public Long getId() {
        return id;
    }

    public String getInvestigationCode() {
        return investigationCode;
    }

    public void setInvestigationCode(String investigationCode) {
        this.investigationCode = investigationCode;
    }

    public SupportTicket getTicket() {
        return ticket;
    }

    public void setTicket(SupportTicket ticket) {
        this.ticket = ticket;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getIntent() {
        return intent;
    }

    public void setIntent(String intent) {
        this.intent = intent;
    }

    public String getSentiment() {
        return sentiment;
    }

    public void setSentiment(String sentiment) {
        this.sentiment = sentiment;
    }

    public String getRootCause() {
        return rootCause;
    }

    public void setRootCause(String rootCause) {
        this.rootCause = rootCause;
    }

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }

    public String getPolicyCheck() {
        return policyCheck;
    }

    public void setPolicyCheck(String policyCheck) {
        this.policyCheck = policyCheck;
    }

    public String getAuthorizationCheck() {
        return authorizationCheck;
    }

    public void setAuthorizationCheck(String authorizationCheck) {
        this.authorizationCheck = authorizationCheck;
    }

    public String getRecommendedAction() {
        return recommendedAction;
    }

    public void setRecommendedAction(String recommendedAction) {
        this.recommendedAction = recommendedAction;
    }

    public String getDecision() {
        return decision;
    }

    public void setDecision(String decision) {
        this.decision = decision;
    }

    public String getCustomerResponse() {
        return customerResponse;
    }

    public void setCustomerResponse(String customerResponse) {
        this.customerResponse = customerResponse;
    }

    public String getEscalationReason() {
        return escalationReason;
    }

    public void setEscalationReason(String escalationReason) {
        this.escalationReason = escalationReason;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}