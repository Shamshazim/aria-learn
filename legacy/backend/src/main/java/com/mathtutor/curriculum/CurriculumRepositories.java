package com.mathtutor.curriculum;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface SubjectRepository extends JpaRepository<Subject, UUID> {
    List<Subject> findByActiveTrueOrderByName();
    List<Subject> findAllByOrderByName();
}
