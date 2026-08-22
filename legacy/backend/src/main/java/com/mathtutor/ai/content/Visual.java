package com.mathtutor.ai.content;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * A structured visual the frontend renders (as SVG) so lessons show concepts instead
 * of just describing them. The AI picks the {@code type} that fits the topic and fills
 * in the relevant fields; unused fields are left null.
 *
 * Types:
 *  - "groups": {groups} groups of {itemsPerGroup}, drawn with {emoji}  (multiplication/division)
 *  - "array": {rows} x {cols} grid of dots                              (multiplication as an array)
 *  - "numberLine": a 0..{max} line with {jumps} marked                 (counting, skip-counting, addition)
 *  - "fractionBar": a bar split into {parts} with {shaded} shaded       (fractions)
 *  - "shape": a {shape} (rectangle/square/triangle/circle) with a label (geometry)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record Visual(
        String type,
        String caption,
        Integer groups,
        Integer itemsPerGroup,
        String emoji,
        Integer rows,
        Integer cols,
        Integer max,
        List<Integer> jumps,
        Integer parts,
        Integer shaded,
        String shape) {
}
