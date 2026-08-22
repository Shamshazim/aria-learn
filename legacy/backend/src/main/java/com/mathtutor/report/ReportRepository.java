package com.mathtutor.report;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

interface ReportRepository extends JpaRepository<Report, UUID> {
}
