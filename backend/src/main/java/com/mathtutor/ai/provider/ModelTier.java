package com.mathtutor.ai.provider;

/**
 * Logical model tiers. The concrete model bound to each tier is configuration,
 * so swapping models (or providers) never touches business logic.
 */
public enum ModelTier {
    /** Higher-quality model for teaching, generation, and evaluation. */
    TEACH,
    /** Fast, small model for low-latency interactions like hints. */
    FAST
}
