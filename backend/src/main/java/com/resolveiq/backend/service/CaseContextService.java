package com.resolveiq.backend.service;

import com.resolveiq.backend.entity.Order;
import com.resolveiq.backend.entity.Payment;
import com.resolveiq.backend.entity.SupportTicket;
import com.resolveiq.backend.repository.OrderRepository;
import com.resolveiq.backend.repository.PaymentRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Shared derivation of the order/payment context that a support ticket concerns,
 * plus duplicate-charge detection. Both the investigation step and the resolution
 * step rely on this so that "what counts as a duplicate charge" is defined once.
 */
@Service
public class CaseContextService {

    private static final long DUPLICATE_WINDOW_MINUTES = 60;
    private static final String PAYMENT_SUCCESS = "SUCCESS";

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;

    public CaseContextService(
            OrderRepository orderRepository,
            PaymentRepository paymentRepository
    ) {
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
    }

    public record OrderContext(
            Order order,
            boolean linkedByReference,
            List<Payment> payments
    ) {
    }

    public record DuplicatePair(
            Payment original,
            Payment duplicate,
            long minutesApart
    ) {
    }

    public OrderContext resolveOrderContext(SupportTicket ticket) {

        String reference = ticket.getOrderReference();
        Order order = null;
        boolean linkedByReference = false;

        if (reference != null && !reference.isBlank()) {
            order = orderRepository.findByOrderCode(reference.trim()).orElse(null);
            linkedByReference = order != null;
        }

        if (order == null) {
            order = orderRepository
                    .findByCustomerIdOrderByOrderDateDesc(ticket.getCustomer().getId())
                    .stream()
                    .findFirst()
                    .orElse(null);
        }

        List<Payment> payments = order == null
                ? List.of()
                : paymentRepository.findByOrderId(order.getId()).stream()
                        .sorted(Comparator.comparing(Payment::getPaymentDate))
                        .toList();

        return new OrderContext(order, linkedByReference, payments);
    }

    /**
     * A duplicate charge is two successful payments on the same order, for the same
     * amount, captured within {@link #DUPLICATE_WINDOW_MINUTES} of each other.
     */
    public List<DuplicatePair> detectDuplicatePayments(List<Payment> payments) {

        Map<Long, List<Payment>> byAmount = payments.stream()
                .filter(payment -> PAYMENT_SUCCESS.equalsIgnoreCase(payment.getStatus()))
                .collect(Collectors.groupingBy(
                        payment -> Math.round(payment.getAmount() * 100),
                        LinkedHashMap::new,
                        Collectors.toList()));

        List<DuplicatePair> duplicates = new ArrayList<>();

        for (List<Payment> group : byAmount.values()) {
            for (int i = 1; i < group.size(); i++) {
                Payment original = group.get(i - 1);
                Payment duplicate = group.get(i);

                long minutesApart = Duration
                        .between(original.getPaymentDate(), duplicate.getPaymentDate())
                        .toMinutes();

                if (minutesApart <= DUPLICATE_WINDOW_MINUTES) {
                    duplicates.add(new DuplicatePair(original, duplicate, minutesApart));
                }
            }
        }

        return duplicates;
    }
}
