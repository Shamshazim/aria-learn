package com.mathtutor.tutor;

import com.mathtutor.auth.Student;
import com.mathtutor.auth.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Resolves tutor personalities. The style prompt returned here is appended to the
 * AI system prompt so a child's chosen personality shapes every generation.
 */
@Service
public class TutorModeService {

    private final TutorModeRepository modeRepository;
    private final StudentRepository studentRepository;

    public TutorModeService(TutorModeRepository modeRepository, StudentRepository studentRepository) {
        this.modeRepository = modeRepository;
        this.studentRepository = studentRepository;
    }

    /** All selectable personalities, for the parent portal. */
    @Transactional(readOnly = true)
    public List<TutorMode> listActive() {
        return modeRepository.findByActiveTrueOrderBySortOrder();
    }

    /** The style instructions for a child's chosen mode (empty string if none/neutral). */
    @Transactional(readOnly = true)
    public String styleForStudent(UUID studentId) {
        if (studentId == null) {
            return "";
        }
        return studentRepository.findById(studentId)
                .map(Student::getTutorModeCode)
                .flatMap(modeRepository::findById)
                .map(TutorMode::getStylePrompt)
                .filter(s -> s != null && !s.isBlank())
                .orElse("");
    }

    /** Whether a mode code exists and is selectable (validates parent input). */
    @Transactional(readOnly = true)
    public boolean isSelectable(String code) {
        return code != null && modeRepository.findById(code).map(TutorMode::isActive).orElse(false);
    }
}
