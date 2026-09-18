package com.resolveiq.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String auditCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "investigation_id")
    private Investigation investigation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "action_id")
    private Action action;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "escalation_id")
    private Escalation escalation;

    @Column(nullable = false)
    private String eventType;

    @Column(nullable = false)
    private String actorType;

    private String actorReference;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String eventDescription;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public AuditLog() {
    }

    public AuditLog(
            String auditCode,
            Investigation investigation,
            Action action,
            Escalation escalation,
            String eventType,
            String actorType,
            String actorReference,
            String eventDescription
    ) {
        this.auditCode = auditCode;
        this.investigation = investigation;
        this.action = action;
        this.escalation = escalation;
        this.eventType = eventType;
        this.actorType = actorType;
        this.actorReference = actorReference;
        this.eventDescription = eventDescription;
    }

    public Long getId() {
        return id;
    }

    public String getAuditCode() {
        return auditCode;
    }

    public void setAuditCode(String auditCode) {
        this.auditCode = auditCode;
    }

    public Investigation getInvestigation() {
        return investigation;
    }

    public void setInvestigation(Investigation investigation) {
        this.investigation = investigation;
    }

    public Action getAction() {
        return action;
    }

    public void setAction(Action action) {
        this.action = action;
    }

    public Escalation getEscalation() {
        return escalation;
    }

    public void setEscalation(Escalation escalation) {
        this.escalation = escalation;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getActorType() {
        return actorType;
    }

    public void setActorType(String actorType) {
        this.actorType = actorType;
    }

    public String getActorReference() {
        return actorReference;
    }

    public void setActorReference(String actorReference) {
        this.actorReference = actorReference;
    }

    public String getEventDescription() {
        return eventDescription;
    }

    public void setEventDescription(String eventDescription) {
        this.eventDescription = eventDescription;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
