package com.mathtutor.homework;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface HomeworkAssignmentRepository extends JpaRepository<HomeworkAssignment, UUID> {
    List<HomeworkAssignment> findByStudentIdOrderByCreatedAtDesc(UUID studentId);
    Optional<HomeworkAssignment> findFirstByStudentIdAndTopicIdOrderByCreatedAtDesc(UUID studentId, UUID topicId);
    boolean existsByStudentIdAndTopicId(UUID studentId, UUID topicId);
}

interface HomeworkQuestionRepository extends JpaRepository<HomeworkQuestion, UUID> {
    List<HomeworkQuestion> findByHomeworkIdOrderByOrdering(UUID homeworkId);
}

interface HomeworkAnswerRepository extends JpaRepository<HomeworkAnswer, UUID> {
    List<HomeworkAnswer> findByHomeworkId(UUID homeworkId);

    @Query("select h.topicId as topicId, a.misconception as misconception "
            + "from HomeworkAnswer a, HomeworkAssignment h "
            + "where a.homeworkId = h.id and h.studentId = :studentId "
            + "and a.misconception is not null and a.misconception <> ''")
    List<MisconceptionView> findMisconceptions(UUID studentId);
}

interface MisconceptionView {
    UUID getTopicId();
    String getMisconception();
}

interface AiEvaluationRepository extends JpaRepository<AiEvaluation, UUID> {
    Optional<AiEvaluation> findByHomeworkId(UUID homeworkId);
}
