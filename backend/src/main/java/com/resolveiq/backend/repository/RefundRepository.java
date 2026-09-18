package com.resolveiq.backend.repository;

import com.resolveiq.backend.entity.Refund;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RefundRepository extends JpaRepository<Refund, Long> {

    Optional<Refund> findByRefundCode(String refundCode);

    List<Refund> findByPaymentId(Long paymentId);

    List<Refund> findByPaymentOrderId(Long orderId);

    boolean existsByRefundCode(String refundCode);
}
