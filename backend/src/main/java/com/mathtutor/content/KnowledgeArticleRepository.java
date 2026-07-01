package com.mathtutor.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface KnowledgeArticleRepository extends JpaRepository<KnowledgeArticle, UUID> {
    Optional<KnowledgeArticle> findByStudentIdAndTopicIdAndActiveTrue(UUID studentId, UUID topicId);
    Optional<KnowledgeArticle> findByTopicIdAndStudentIdIsNullAndActiveTrue(UUID topicId);
}
