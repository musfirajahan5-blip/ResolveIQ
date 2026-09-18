package com.resolveiq.backend.repository;

import com.resolveiq.backend.entity.Evidence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EvidenceRepository extends JpaRepository<Evidence, Long> {

    Optional<Evidence> findByEvidenceCode(String evidenceCode);

    List<Evidence> findByInvestigationId(Long investigationId);

    List<Evidence> findByInvestigationIdOrderByCreatedAtAsc(Long investigationId);

    boolean existsByEvidenceCode(String evidenceCode);
}