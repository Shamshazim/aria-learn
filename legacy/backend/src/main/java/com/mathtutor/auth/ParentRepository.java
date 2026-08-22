package com.mathtutor.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ParentRepository extends JpaRepository<Parent, UUID> {
    Optional<Parent> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
}
