package com.resolveiq.backend.repository;

import com.resolveiq.backend.entity.Escalation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EscalationRepository extends JpaRepository<Escalation, Long> {

    Optional<Escalation> findByEscalationCode(String escalationCode);

    List<Escalation> findByInvestigationId(Long investigationId);

    List<Escalation> findByStatus(String status);

    boolean existsByEscalationCode(String escalationCode);
}