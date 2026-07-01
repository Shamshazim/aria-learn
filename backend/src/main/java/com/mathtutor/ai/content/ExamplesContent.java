package com.mathtutor.ai.content;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ExamplesContent(List<WorkedExample> examples) {
}
