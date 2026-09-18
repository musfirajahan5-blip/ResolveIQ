package com.resolveiq.backend.repository;

import com.resolveiq.backend.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByPaymentCode(String paymentCode);

    List<Payment> findByOrderId(Long orderId);

    List<Payment> findByOrderIdOrderByPaymentDateDesc(Long orderId);

    boolean existsByPaymentCode(String paymentCode);
}