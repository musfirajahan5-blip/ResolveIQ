package com.resolveiq.backend.repository;

import com.resolveiq.backend.entity.Investigation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InvestigationRepository extends JpaRepository<Investigation, Long> {

    Optional<Investigation> findByInvestigationCode(String investigationCode);

    Optional<Investigation> findByTicketId(Long ticketId);

    boolean existsByInvestigationCode(String investigationCode);
}