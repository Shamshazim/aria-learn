package com.mathtutor.flag;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface QuestionFlagRepository extends JpaRepository<QuestionFlag, UUID> {

    List<QuestionFlag> findByStudentIdInAndResolvedFalseOrderByCreatedAtDesc(Collection<UUID> studentIds);

    boolean existsByQuestionIdAndStudentIdAndResolvedFalse(UUID questionId, UUID studentId);
}
