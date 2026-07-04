package com.mathtutor.flag;

import com.mathtutor.auth.Student;
import com.mathtutor.auth.StudentRepository;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.common.ForbiddenException;
import com.mathtutor.common.NotFoundException;
import com.mathtutor.practice.QuestionBank;
import com.mathtutor.practice.QuestionBankRepository;
import com.mathtutor.practice.QuestionStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Records "report this question" flags and surfaces them to the owning parent. */
@Service
public class FlagService {

    private final QuestionFlagRepository flagRepository;
    private final QuestionBankRepository questionRepository;
    private final StudentRepository studentRepository;
    private final QuestionStore questionStore;

    public FlagService(QuestionFlagRepository flagRepository,
                       QuestionBankRepository questionRepository,
                       StudentRepository studentRepository,
                       QuestionStore questionStore) {
        this.flagRepository = flagRepository;
        this.questionRepository = questionRepository;
        this.studentRepository = studentRepository;
        this.questionStore = questionStore;
    }

    public record FlagDto(UUID flagId, UUID questionId, String childName, String questionType,
                          String prompt, List<String> choices, String correctAnswer,
                          String solution, String reason, Instant createdAt) {
    }

    /** A student reports a question. Ignores a duplicate open report from the same student. */
    @Transactional
    public void flag(UUID studentId, UUID questionId, String reason) {
        if (!questionRepository.existsById(questionId)) {
            throw new NotFoundException("Question not found");
        }
        if (flagRepository.existsByQuestionIdAndStudentIdAndResolvedFalse(questionId, studentId)) {
            return; // already reported and still open — nothing to do
        }
        QuestionFlag flag = new QuestionFlag();
        flag.setQuestionId(questionId);
        flag.setStudentId(studentId);
        flag.setReason(reason == null || reason.isBlank() ? null : reason.trim());
        flagRepository.save(flag);
    }

    /** Open flags across all of the parent's children, enriched with question detail. */
    @Transactional(readOnly = true)
    public List<FlagDto> openForParent(AuthPrincipal parent) {
        Map<UUID, String> childNames = studentRepository.findByParentIdAndActiveTrue(parent.id()).stream()
                .collect(Collectors.toMap(Student::getId, Student::getDisplayName));
        if (childNames.isEmpty()) {
            return List.of();
        }
        return flagRepository
                .findByStudentIdInAndResolvedFalseOrderByCreatedAtDesc(childNames.keySet()).stream()
                .map(f -> {
                    QuestionBank q = questionRepository.findById(f.getQuestionId()).orElse(null);
                    return new FlagDto(f.getId(), f.getQuestionId(),
                            childNames.getOrDefault(f.getStudentId(), "Your child"),
                            q == null ? null : q.getType(),
                            q == null ? "(question no longer available)" : q.getPromptText(),
                            q == null ? List.of() : questionStore.readChoices(q.getChoices()),
                            q == null ? null : q.getCorrectAnswer(),
                            q == null ? null : q.getSolution(),
                            f.getReason(), f.getCreatedAt());
                })
                .toList();
    }

    /** Parent dismisses a flag (must belong to one of their children). */
    @Transactional
    public void resolve(AuthPrincipal parent, UUID flagId) {
        QuestionFlag flag = flagRepository.findById(flagId)
                .orElseThrow(() -> new NotFoundException("Flag not found"));
        boolean owned = studentRepository.findByParentIdAndActiveTrue(parent.id()).stream()
                .anyMatch(s -> s.getId().equals(flag.getStudentId()));
        if (!owned) {
            throw new ForbiddenException("This report does not belong to your children");
        }
        flag.setResolved(true);
        flagRepository.save(flag);
    }

    /** Small helper so the frontend can show a badge count. */
    @Transactional(readOnly = true)
    public long openCountForParent(AuthPrincipal parent) {
        Function<Student, UUID> id = Student::getId;
        List<UUID> ids = studentRepository.findByParentIdAndActiveTrue(parent.id()).stream()
                .map(id).toList();
        return ids.isEmpty() ? 0
                : flagRepository.findByStudentIdInAndResolvedFalseOrderByCreatedAtDesc(ids).size();
    }
}
