package com.resolveiq.backend.service;

import com.resolveiq.backend.entity.Customer;
import com.resolveiq.backend.exception.ResourceNotFoundException;
import com.resolveiq.backend.repository.CustomerRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    public List<Customer> getAllCustomers() {
        return customerRepository.findAll();
    }

    public Customer getCustomerById(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Customer not found with id: " + id));
    }

    public Customer getCustomerByCode(String customerCode) {
        return customerRepository.findByCustomerCode(customerCode)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Customer not found: " + customerCode));
    }

    public Customer createCustomer(Customer customer) {
        return customerRepository.save(customer);
    }
}
