package com.resolveiq.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "escalations")
public class Escalation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String escalationCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "investigation_id", nullable = false)
    private Investigation investigation;

    @Column(nullable = false)
    private String reason;

    private String priority;

    private String status;

    private String assignedTo;

    @Column(columnDefinition = "TEXT")
    private String handoffSummary;

    private LocalDateTime escalatedAt;

    private LocalDateTime resolvedAt;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();

        if (escalatedAt == null) {
            escalatedAt = LocalDateTime.now();
        }

        if (status == null || status.isBlank()) {
            status = "OPEN";
        }

        if (priority == null || priority.isBlank()) {
            priority = "MEDIUM";
        }
    }

    public Escalation() {
    }

    public Escalation(
            String escalationCode,
            Investigation investigation,
            String reason,
            String priority,
            String status,
            String assignedTo,
            String handoffSummary
    ) {
        this.escalationCode = escalationCode;
        this.investigation = investigation;
        this.reason = reason;
        this.priority = priority;
        this.status = status;
        this.assignedTo = assignedTo;
        this.handoffSummary = handoffSummary;
    }

    public Long getId() {
        return id;
    }

    public String getEscalationCode() {
        return escalationCode;
    }

    public void setEscalationCode(String escalationCode) {
        this.escalationCode = escalationCode;
    }

    public Investigation getInvestigation() {
        return investigation;
    }

    public void setInvestigation(Investigation investigation) {
        this.investigation = investigation;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getAssignedTo() {
        return assignedTo;
    }

    public void setAssignedTo(String assignedTo) {
        this.assignedTo = assignedTo;
    }

    public String getHandoffSummary() {
        return handoffSummary;
    }

    public void setHandoffSummary(String handoffSummary) {
        this.handoffSummary = handoffSummary;
    }

    public LocalDateTime getEscalatedAt() {
        return escalatedAt;
    }

    public LocalDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(LocalDateTime resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}