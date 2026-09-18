package com.resolveiq.backend.service;

import com.resolveiq.backend.entity.Customer;
import com.resolveiq.backend.entity.SupportTicket;
import com.resolveiq.backend.exception.ResourceNotFoundException;
import com.resolveiq.backend.repository.CustomerRepository;
import com.resolveiq.backend.repository.SupportTicketRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class SupportTicketService {

    private final SupportTicketRepository supportTicketRepository;
    private final CustomerRepository customerRepository;

    public SupportTicketService(
            SupportTicketRepository supportTicketRepository,
            CustomerRepository customerRepository
    ) {
        this.supportTicketRepository = supportTicketRepository;
        this.customerRepository = customerRepository;
    }

    public List<SupportTicket> getAllTickets() {
        return supportTicketRepository.findAll();
    }

    public SupportTicket getTicketById(Long id) {
        return supportTicketRepository.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Support ticket not found with id: " + id));
    }

    public SupportTicket getTicketByCaseId(String caseId) {
        return supportTicketRepository.findByCaseId(caseId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Support ticket not found: " + caseId));
    }

    public SupportTicket createTicket(
            Long customerId,
            String category,
            String orderReference,
            String subject,
            String description
    ) {

        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Customer not found with id: " + customerId));

        String caseId = generateCaseId();

        SupportTicket ticket = new SupportTicket(
                caseId,
                customer,
                category,
                orderReference,
                subject,
                description,
                "OPEN"
        );

        return supportTicketRepository.save(ticket);
    }

    private String generateCaseId() {
        String caseId;

        do {
            caseId = "CASE-" +
                    UUID.randomUUID()
                            .toString()
                            .substring(0, 8)
                            .toUpperCase();
        } while (supportTicketRepository.existsByCaseId(caseId));

        return caseId;
    }
}