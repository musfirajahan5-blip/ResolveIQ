package com.resolveiq.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "refunds")
public class Refund {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String refundCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false)
    private Payment payment;

    @Column(nullable = false)
    private Double amount;

    private String status;

    private String reason;

    private String refundReference;

    private LocalDateTime requestedAt;

    private LocalDateTime processedAt;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();

        if (requestedAt == null) {
            requestedAt = LocalDateTime.now();
        }

        if (status == null || status.isBlank()) {
            status = "PENDING";
        }
    }

    public Refund() {
    }

    public Refund(
            String refundCode,
            Payment payment,
            Double amount,
            String status,
            String reason,
            String refundReference,
            LocalDateTime requestedAt,
            LocalDateTime processedAt
    ) {
        this.refundCode = refundCode;
        this.payment = payment;
        this.amount = amount;
        this.status = status;
        this.reason = reason;
        this.refundReference = refundReference;
        this.requestedAt = requestedAt;
        this.processedAt = processedAt;
    }

    public Long getId() {
        return id;
    }

    public String getRefundCode() {
        return refundCode;
    }

    public void setRefundCode(String refundCode) {
        this.refundCode = refundCode;
    }

    public Payment getPayment() {
        return payment;
    }

    public void setPayment(Payment payment) {
        this.payment = payment;
    }

    public Double getAmount() {
        return amount;
    }

    public void setAmount(Double amount) {
        this.amount = amount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getRefundReference() {
        return refundReference;
    }

    public void setRefundReference(String refundReference) {
        this.refundReference = refundReference;
    }

    public LocalDateTime getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(LocalDateTime requestedAt) {
        this.requestedAt = requestedAt;
    }

    public LocalDateTime getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(LocalDateTime processedAt) {
        this.processedAt = processedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
