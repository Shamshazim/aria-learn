package com.mathtutor.ai.prompt;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PromptTemplateRepository extends JpaRepository<PromptTemplate, UUID> {

    Optional<PromptTemplate> findByNameAndActiveTrue(String name);

    List<PromptTemplate> findByActiveTrueOrderByNameAsc();

    List<PromptTemplate> findByNameOrderByVersionDesc(String name);

    Optional<PromptTemplate> findByNameAndVersion(String name, int version);

    @Query("select coalesce(max(p.version), 0) from PromptTemplate p where p.name = :name")
    int maxVersion(String name);
}
