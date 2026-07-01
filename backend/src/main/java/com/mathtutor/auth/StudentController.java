package com.mathtutor.auth;

import com.mathtutor.auth.dto.StudentDtos.CreateStudentRequest;
import com.mathtutor.auth.dto.StudentDtos.ResetPasswordRequest;
import com.mathtutor.auth.dto.StudentDtos.StudentResponse;
import com.mathtutor.auth.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/parent/students")
@PreAuthorize("hasRole('PARENT')")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    @PostMapping
    public StudentResponse create(@Valid @RequestBody CreateStudentRequest request) {
        return studentService.createStudent(SecurityUtils.currentPrincipal(), request);
    }

    @GetMapping
    public List<StudentResponse> list() {
        return studentService.listMyStudents(SecurityUtils.currentPrincipal());
    }

    /** Parent resets one of their children's passwords. */
    @PostMapping("/{studentId}/password")
    public void resetPassword(@PathVariable UUID studentId, @Valid @RequestBody ResetPasswordRequest request) {
        studentService.resetStudentPassword(SecurityUtils.currentPrincipal(), studentId, request.newPassword());
    }
}

