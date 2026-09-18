package com.resolveiq.backend.repository;

import com.resolveiq.backend.entity.Action;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ActionRepository extends JpaRepository<Action, Long> {

    Optional<Action> findByActionCode(String actionCode);

    List<Action> findByInvestigationId(Long investigationId);

    List<Action> findByInvestigationIdOrderByCreatedAtAsc(Long investigationId);

    boolean existsByActionCode(String actionCode);
}