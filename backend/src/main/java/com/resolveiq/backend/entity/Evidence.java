package com.resolveiq.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "evidence")
public class Evidence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String evidenceCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "investigation_id", nullable = false)
    private Investigation investigation;

    @Column(nullable = false)
    private String evidenceType;

    @Column(nullable = false)
    private String sourceType;

    private String sourceReference;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    private String relevance;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Evidence() {
    }

    public Evidence(
            String evidenceCode,
            Investigation investigation,
            String evidenceType,
            String sourceType,
            String sourceReference,
            String description,
            String relevance
    ) {
        this.evidenceCode = evidenceCode;
        this.investigation = investigation;
        this.evidenceType = evidenceType;
        this.sourceType = sourceType;
        this.sourceReference = sourceReference;
        this.description = description;
        this.relevance = relevance;
    }

    public Long getId() {
        return id;
    }

    public String getEvidenceCode() {
        return evidenceCode;
    }

    public void setEvidenceCode(String evidenceCode) {
        this.evidenceCode = evidenceCode;
    }

    public Investigation getInvestigation() {
        return investigation;
    }

    public void setInvestigation(Investigation investigation) {
        this.investigation = investigation;
    }

    public String getEvidenceType() {
        return evidenceType;
    }

    public void setEvidenceType(String evidenceType) {
        this.evidenceType = evidenceType;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public String getSourceReference() {
        return sourceReference;
    }

    public void setSourceReference(String sourceReference) {
        this.sourceReference = sourceReference;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getRelevance() {
        return relevance;
    }

    public void setRelevance(String relevance) {
        this.relevance = relevance;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}