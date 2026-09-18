package com.resolveiq.backend.repository;

import com.resolveiq.backend.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByOrderCode(String orderCode);

    List<Order> findByCustomerId(Long customerId);

    List<Order> findByCustomerIdOrderByOrderDateDesc(Long customerId);
}
