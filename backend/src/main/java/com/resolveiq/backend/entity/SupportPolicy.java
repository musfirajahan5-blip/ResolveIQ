package com.resolveiq.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "support_policies")
public class SupportPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String policyCode;

    @Column(nullable = false)
    private String policyName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String category;

    private Double maximumAutoRefundAmount;

    private Boolean autoResolutionAllowed;

    private Boolean managerApprovalRequired;

    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();

        if (status == null || status.isBlank()) {
            status = "ACTIVE";
        }

        if (autoResolutionAllowed == null) {
            autoResolutionAllowed = false;
        }

        if (managerApprovalRequired == null) {
            managerApprovalRequired = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public SupportPolicy() {
    }

    public SupportPolicy(
            String policyCode,
            String policyName,
            String description,
            String category,
            Double maximumAutoRefundAmount,
            Boolean autoResolutionAllowed,
            Boolean managerApprovalRequired,
            String status
    ) {
        this.policyCode = policyCode;
        this.policyName = policyName;
        this.description = description;
        this.category = category;
        this.maximumAutoRefundAmount = maximumAutoRefundAmount;
        this.autoResolutionAllowed = autoResolutionAllowed;
        this.managerApprovalRequired = managerApprovalRequired;
        this.status = status;
    }

    public Long getId() {
        return id;
    }

    public String getPolicyCode() {
        return policyCode;
    }

    public void setPolicyCode(String policyCode) {
        this.policyCode = policyCode;
    }

    public String getPolicyName() {
        return policyName;
    }

    public void setPolicyName(String policyName) {
        this.policyName = policyName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Double getMaximumAutoRefundAmount() {
        return maximumAutoRefundAmount;
    }

    public void setMaximumAutoRefundAmount(Double maximumAutoRefundAmount) {
        this.maximumAutoRefundAmount = maximumAutoRefundAmount;
    }

    public Boolean getAutoResolutionAllowed() {
        return autoResolutionAllowed;
    }

    public void setAutoResolutionAllowed(Boolean autoResolutionAllowed) {
        this.autoResolutionAllowed = autoResolutionAllowed;
    }

    public Boolean getManagerApprovalRequired() {
        return managerApprovalRequired;
    }

    public void setManagerApprovalRequired(Boolean managerApprovalRequired) {
        this.managerApprovalRequired = managerApprovalRequired;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}