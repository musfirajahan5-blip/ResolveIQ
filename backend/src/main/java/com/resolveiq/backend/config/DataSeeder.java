package com.resolveiq.backend.config;

import com.resolveiq.backend.entity.*;
import com.resolveiq.backend.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Component
public class DataSeeder implements CommandLineRunner {

    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final SupportPolicyRepository supportPolicyRepository;

    public DataSeeder(
            CustomerRepository customerRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository,
            PaymentRepository paymentRepository,
            RefundRepository refundRepository,
            SupportPolicyRepository supportPolicyRepository
    ) {
        this.customerRepository = customerRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
        this.refundRepository = refundRepository;
        this.supportPolicyRepository = supportPolicyRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        seedPolicies();

        if (customerRepository.count() == 0) {
            seedCoreData();
        }

        seedDuplicatePaymentScenario();
    }

    private void seedCoreData() {
        Customer alex = customerRepository.save(new Customer(
                "CUST-001", "Alex Johnson", "alex.johnson@example.com",
                "+1-555-0101", "ACTIVE"));
        Customer priya = customerRepository.save(new Customer(
                "CUST-002", "Priya Nair", "priya.nair@example.com",
                "+1-555-0102", "ACTIVE"));
        Customer marcus = customerRepository.save(new Customer(
                "CUST-003", "Marcus Lee", "marcus.lee@example.com",
                "+1-555-0103", "ACTIVE"));

        Product headphones = saveProduct(new Product(
                "PROD-001", "Aurora Wireless Headphones",
                "Over-ear noise cancelling headphones with 30h battery life.",
                "ELECTRONICS", 199.99, "ACTIVE"));
        Product watch = saveProduct(new Product(
                "PROD-002", "Pulse Fitness Watch",
                "Fitness tracker with heart-rate and sleep monitoring.",
                "ELECTRONICS", 149.50, "ACTIVE"));
        Product backpack = saveProduct(new Product(
                "PROD-003", "Trailhead Backpack 30L",
                "Water-resistant hiking backpack with laptop sleeve.",
                "ACCESSORIES", 89.00, "ACTIVE"));

        LocalDateTime now = LocalDateTime.now();

        Order alexOrder = orderRepository.save(new Order(
                "ORD-1001", alex, headphones, 1, 199.99,
                "DELIVERED", now.minusDays(12)));
        Order priyaOrder = orderRepository.save(new Order(
                "ORD-1002", priya, watch, 1, 149.50,
                "DELIVERED", now.minusDays(8)));
        Order marcusOrder = orderRepository.save(new Order(
                "ORD-1003", marcus, backpack, 2, 178.00,
                "SHIPPED", now.minusDays(3)));

        savePayment(new Payment(
                "PAY-2001", alexOrder, 199.99, "CREDIT_CARD",
                "SUCCESS", "TXN-AJ-88213", now.minusDays(12)));
        savePayment(new Payment(
                "PAY-2002", priyaOrder, 149.50, "UPI",
                "SUCCESS", "TXN-PN-44519", now.minusDays(8)));
        savePayment(new Payment(
                "PAY-2003", marcusOrder, 178.00, "CREDIT_CARD",
                "SUCCESS", "TXN-ML-77034", now.minusDays(3)));
    }

    private void seedDuplicatePaymentScenario() {
        Order alexOrder = orderRepository.findByOrderCode("ORD-1001").orElse(null);

        if (alexOrder == null) {
            return;
        }

        LocalDateTime originalPaymentDate = alexOrder.getOrderDate();

        Payment duplicateCharge = savePayment(new Payment(
                "PAY-2004", alexOrder, 199.99, "CREDIT_CARD",
                "SUCCESS", "TXN-AJ-88467", originalPaymentDate.plusMinutes(4)));

        saveRefund(new Refund(
                "REF-3001", duplicateCharge, 199.99, "PENDING",
                "Customer charged twice for order ORD-1001 in the same session.",
                "RFND-AJ-51002", originalPaymentDate.plusDays(1), null));
    }

    private void seedPolicies() {
        savePolicy(new SupportPolicy(
                "POL-REFUND-STD", "Standard Refund Window",
                "Refunds are auto-approved within 30 days of delivery for amounts up to 200.",
                "REFUND", 200.00, true, false, "ACTIVE"));
        savePolicy(new SupportPolicy(
                "POL-DUP-PAYMENT", "Duplicate Payment Reversal",
                "Confirmed duplicate charges are reversed automatically with no amount ceiling review.",
                "PAYMENT", 500.00, true, false, "ACTIVE"));
        savePolicy(new SupportPolicy(
                "POL-HIGH-VALUE", "High Value Manual Review",
                "Any resolution above 500 requires manager approval before action is taken.",
                "REFUND", 0.00, false, true, "ACTIVE"));
        savePolicy(new SupportPolicy(
                "POL-DELIVERY", "Delivery Issue Handling",
                "Lost or damaged deliveries are investigated against carrier evidence before refund.",
                "DELIVERY", 150.00, false, false, "ACTIVE"));
    }

    private Product saveProduct(Product product) {
        if (productRepository.existsByProductCode(product.getProductCode())) {
            return productRepository.findByProductCode(product.getProductCode()).orElseThrow();
        }
        return productRepository.save(product);
    }

    private Payment savePayment(Payment payment) {
        return paymentRepository.findByPaymentCode(payment.getPaymentCode())
                .orElseGet(() -> paymentRepository.save(payment));
    }

    private void saveRefund(Refund refund) {
        if (!refundRepository.existsByRefundCode(refund.getRefundCode())) {
            refundRepository.save(refund);
        }
    }

    private void savePolicy(SupportPolicy policy) {
        if (!supportPolicyRepository.existsByPolicyCode(policy.getPolicyCode())) {
            supportPolicyRepository.save(policy);
        }
    }
}
