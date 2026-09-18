package com.resolveiq.backend.repository;

import com.resolveiq.backend.entity.Conversation;
import com.resolveiq.backend.entity.SupportTicket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    List<Conversation> findByTicketOrderByCreatedAtAsc(SupportTicket ticket);

    List<Conversation> findByTicketIdOrderByCreatedAtAsc(Long ticketId);
}
