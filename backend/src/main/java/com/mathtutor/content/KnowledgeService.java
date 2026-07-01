package com.mathtutor.content;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.adaptive.AdaptiveRules;
import com.mathtutor.ai.GenerationContext;
import com.mathtutor.ai.GenerationService;
import com.mathtutor.ai.content.KnowledgeContent;
import com.mathtutor.common.AiException;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.curriculum.CurriculumService.TopicContext;
import com.mathtutor.mastery.MasteryRecord;
import com.mathtutor.mastery.MasteryService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class KnowledgeService {

    private final KnowledgeArticleRepository repository;
    private final CurriculumService curriculumService;
    private final GenerationService generationService;
    private final MasteryService masteryService;
    private final ObjectMapper objectMapper;

    public KnowledgeService(KnowledgeArticleRepository repository,
                            CurriculumService curriculumService,
                            GenerationService generationService,
                            MasteryService masteryService,
                            ObjectMapper objectMapper) {
        this.repository = repository;
        this.curriculumService = curriculumService;
        this.generationService = generationService;
        this.masteryService = masteryService;
        this.objectMapper = objectMapper;
    }

    /**
     * Returns the knowledge article for a topic, personalized to the given student.
     * studentId == null produces a generic (parent-preview) version.
     */
    @Transactional
    public KnowledgeView getOrGenerate(UUID studentId, UUID topicId) {
        TopicContext ctx = curriculumService.resolveTopicContext(topicId);

        var existing = studentId != null
                ? repository.findByStudentIdAndTopicIdAndActiveTrue(studentId, topicId)
                : repository.findByTopicIdAndStudentIdIsNullAndActiveTrue(topicId);
        if (existing.isPresent()) {
            return new KnowledgeView(topicId, ctx.topicName(), deserialize(existing.get().getBody()));
        }

        GenerationContext genCtx = new GenerationContext(
                ctx.subjectName(), ctx.gradeName(), ctx.topicName(), ctx.objectives(),
                learnerNote(studentId, topicId));
        KnowledgeContent content = generationService.generateKnowledge(genCtx);

        KnowledgeArticle article = new KnowledgeArticle();
        article.setTopicId(topicId);
        article.setStudentId(studentId);
        article.setBody(serialize(content));
        repository.save(article);

        return new KnowledgeView(topicId, ctx.topicName(), content);
    }

    /** Generates a fresh, simpler re-explanation of a topic (not cached — each call differs). */
    @Transactional(readOnly = true)
    public KnowledgeView elaborate(UUID studentId, UUID topicId) {
        TopicContext ctx = curriculumService.resolveTopicContext(topicId);
        GenerationContext genCtx = new GenerationContext(
                ctx.subjectName(), ctx.gradeName(), ctx.topicName(), ctx.objectives(),
                learnerNote(studentId, topicId));
        return new KnowledgeView(topicId, ctx.topicName(), generationService.elaborate(genCtx));
    }

    private String learnerNote(UUID studentId, UUID topicId) {
        if (studentId == null) {
            return AdaptiveRules.learnerNote("MEDIUM");
        }
        MasteryRecord r = masteryService.getOrEmpty(studentId, topicId);
        Integer acc = (r != null && r.getPracticeTotal() > 0)
                ? Math.round(r.getPracticeCorrect() * 100f / r.getPracticeTotal())
                : null;
        return AdaptiveRules.learnerNote(AdaptiveRules.suggestDifficulty(acc));
    }

    private String serialize(KnowledgeContent content) {
        try {
            return objectMapper.writeValueAsString(content);
        } catch (Exception e) {
            throw new AiException("Failed to serialize knowledge content", e);
        }
    }

    private KnowledgeContent deserialize(String body) {
        try {
            return objectMapper.readValue(body, KnowledgeContent.class);
        } catch (Exception e) {
            throw new AiException("Failed to read cached knowledge content", e);
        }
    }

    public record KnowledgeView(UUID topicId, String topicName, KnowledgeContent content) {
    }
}
