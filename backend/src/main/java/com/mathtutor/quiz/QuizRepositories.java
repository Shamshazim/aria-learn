package com.mathtutor.quiz;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface QuizRepository extends JpaRepository<Quiz, UUID> {
}

interface QuizQuestionRepository extends JpaRepository<QuizQuestion, UUID> {
    List<QuizQuestion> findByQuizIdOrderByOrdering(UUID quizId);
}

interface AttemptRepository extends JpaRepository<Attempt, UUID> {
}

interface StudentAnswerRepository extends JpaRepository<StudentAnswer, UUID> {
}
