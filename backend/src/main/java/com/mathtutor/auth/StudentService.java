package com.mathtutor.auth;

import com.mathtutor.auth.dto.StudentDtos.CreateStudentRequest;
import com.mathtutor.auth.dto.StudentDtos.StudentResponse;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.common.BadRequestException;
import com.mathtutor.common.ForbiddenException;
import com.mathtutor.common.NotFoundException;
import com.mathtutor.curriculum.GradeRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class StudentService {

    private final StudentRepository studentRepository;
    private final GradeRepository gradeRepository;
    private final PasswordEncoder passwordEncoder;
    private final com.mathtutor.enrollment.EnrollmentService enrollmentService;

    public StudentService(StudentRepository studentRepository,
                          GradeRepository gradeRepository,
                          PasswordEncoder passwordEncoder,
                          com.mathtutor.enrollment.EnrollmentService enrollmentService) {
        this.studentRepository = studentRepository;
        this.gradeRepository = gradeRepository;
        this.passwordEncoder = passwordEncoder;
        this.enrollmentService = enrollmentService;
    }

    @Transactional
    public StudentResponse createStudent(AuthPrincipal parent, CreateStudentRequest req) {
        if (studentRepository.existsByUsernameIgnoreCase(req.username().trim())) {
            throw new BadRequestException("Username already taken");
        }
        if (!gradeRepository.existsById(req.gradeId())) {
            throw new NotFoundException("Grade not found: " + req.gradeId());
        }
        Student student = new Student();
        student.setParentId(parent.id());
        student.setUsername(req.username().trim());
        student.setPasswordHash(passwordEncoder.encode(req.password()));
        student.setDisplayName(req.displayName().trim());
        student.setCurrentGradeId(req.gradeId());
        student.setBirthYear(req.birthYear());
        student = studentRepository.save(student);
        enrollmentService.enroll(student.getId(), req.gradeId()); // first subject enrollment
        return toResponse(student);
    }

    @Transactional(readOnly = true)
    public List<StudentResponse> listMyStudents(AuthPrincipal parent) {
        return studentRepository.findByParentIdAndActiveTrue(parent.id())
                .stream().map(StudentService::toResponse).toList();
    }

    /** Parent resets one of their children's passwords (no current password required). */
    @Transactional
    public void resetStudentPassword(AuthPrincipal parent, UUID studentId, String newPassword) {
        Student student = requireOwnedStudent(parent, studentId);
        student.setPasswordHash(passwordEncoder.encode(newPassword));
        studentRepository.save(student);
    }

    /**
     * Returns a student only if it belongs to the given parent — enforces data isolation.
     */
    @Transactional(readOnly = true)
    public Student requireOwnedStudent(AuthPrincipal parent, UUID studentId) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new NotFoundException("Student not found"));
        if (!student.getParentId().equals(parent.id())) {
            throw new ForbiddenException("This student does not belong to you");
        }
        return student;
    }

    private static StudentResponse toResponse(Student s) {
        return new StudentResponse(s.getId(), s.getUsername(), s.getDisplayName(),
                s.getAvatar(), s.getCurrentGradeId(), s.getBirthYear());
    }
}
