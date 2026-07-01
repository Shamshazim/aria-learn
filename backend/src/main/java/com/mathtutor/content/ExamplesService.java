package com.mathtutor.content;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.adaptive.AdaptiveRules;
import com.mathtutor.ai.GenerationContext;
import com.mathtutor.ai.GenerationService;
import com.mathtutor.ai.content.ExamplesContent;
import com.mathtutor.common.AiException;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.curriculum.CurriculumService.TopicContext;
import com.mathtutor.mastery.MasteryRecord;
import com.mathtutor.mastery.MasteryService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ExamplesService {

    private final ExampleSetRepository repository;
    private final CurriculumService curriculumService;
    private final GenerationService generationService;
    private final MasteryService masteryService;
    private final ObjectMapper objectMapper;

    public ExamplesService(ExampleSetRepository repository,
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

    @Transactional
    public ExamplesView getOrGenerate(UUID studentId, UUID topicId) {
        TopicContext ctx = curriculumService.resolveTopicContext(topicId);

        var existing = studentId != null
                ? repository.findByStudentIdAndTopicIdAndActiveTrue(studentId, topicId)
                : repository.findByTopicIdAndStudentIdIsNullAndActiveTrue(topicId);
        if (existing.isPresent()) {
            return new ExamplesView(topicId, ctx.topicName(), deserialize(existing.get().getBody()));
        }

        GenerationContext genCtx = new GenerationContext(
                ctx.subjectName(), ctx.gradeName(), ctx.topicName(), ctx.objectives(),
                learnerNote(studentId, topicId));
        ExamplesContent content = generationService.generateExamples(genCtx);

        ExampleSet set = new ExampleSet();
        set.setTopicId(topicId);
        set.setStudentId(studentId);
        set.setBody(serialize(content));
        repository.save(set);

        return new ExamplesView(topicId, ctx.topicName(), content);
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

    private String serialize(ExamplesContent content) {
        try {
            return objectMapper.writeValueAsString(content);
        } catch (Exception e) {
            throw new AiException("Failed to serialize examples", e);
        }
    }

    private ExamplesContent deserialize(String body) {
        try {
            return objectMapper.readValue(body, ExamplesContent.class);
        } catch (Exception e) {
            throw new AiException("Failed to read cached examples", e);
        }
    }

    public record ExamplesView(UUID topicId, String topicName, ExamplesContent content) {
    }
}
