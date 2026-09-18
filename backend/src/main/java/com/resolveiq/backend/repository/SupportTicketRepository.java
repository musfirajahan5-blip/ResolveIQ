package com.resolveiq.backend.repository;

import com.resolveiq.backend.entity.SupportTicket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long> {

    Optional<SupportTicket> findByCaseId(String caseId);

    boolean existsByCaseId(String caseId);

    long countByStatus(String status);
}