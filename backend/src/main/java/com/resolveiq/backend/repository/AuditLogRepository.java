package com.resolveiq.backend.repository;

import com.resolveiq.backend.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Optional<AuditLog> findByAuditCode(String auditCode);

    List<AuditLog> findByInvestigationIdOrderByCreatedAtAsc(Long investigationId);

    List<AuditLog> findByActionIdOrderByCreatedAtAsc(Long actionId);

    List<AuditLog> findByEscalationIdOrderByCreatedAtAsc(Long escalationId);

    List<AuditLog> findAllByOrderByCreatedAtDesc();

    boolean existsByAuditCode(String auditCode);
}