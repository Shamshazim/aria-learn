package com.mathtutor.tutor;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TutorModeRepository extends JpaRepository<TutorMode, String> {

    List<TutorMode> findByActiveTrueOrderBySortOrder();
}
