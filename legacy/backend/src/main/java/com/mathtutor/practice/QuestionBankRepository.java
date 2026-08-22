package com.mathtutor.practice;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface QuestionBankRepository extends JpaRepository<QuestionBank, UUID> {
}
