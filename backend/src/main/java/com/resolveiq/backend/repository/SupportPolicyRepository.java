package com.resolveiq.backend.repository;

import com.resolveiq.backend.entity.SupportPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupportPolicyRepository extends JpaRepository<SupportPolicy, Long> {

    Optional<SupportPolicy> findByPolicyCode(String policyCode);

    List<SupportPolicy> findByCategoryAndStatus(String category, String status);

    List<SupportPolicy> findByStatus(String status);

    boolean existsByPolicyCode(String policyCode);
}
