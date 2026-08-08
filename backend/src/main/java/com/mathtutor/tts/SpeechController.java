package com.mathtutor.tts;

import jakarta.validation.constraints.NotBlank;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

/**
 * Narration audio for the animated tutor.
 *
 * The frontend fetches this with its bearer token and plays the bytes as a blob, rather
 * than pointing an audio element at the URL, because a plain media request would carry
 * no credentials.
 */
@RestController
@RequestMapping("/api/v1/speech")
public class SpeechController {

    private final SpeechService speechService;

    public SpeechController(SpeechService speechService) {
        this.speechService = speechService;
    }

    public record SpeechRequest(@NotBlank String text, String voice) {}
    public record SpeechStatus(boolean available, String defaultVoice, List<String> voices) {}

    /** Lets the client decide whether to use server audio or fall back to browser speech. */
    @GetMapping("/status")
    public SpeechStatus status() {
        return new SpeechStatus(speechService.isAvailable(), speechService.defaultVoice(), speechService.voices());
    }

    @PostMapping
    public ResponseEntity<byte[]> speak(@RequestBody SpeechRequest request) {
        if (!speechService.isAvailable()) return ResponseEntity.notFound().build();

        byte[] audio = speechService.render(request.text(), request.voice());
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("audio/mp4"))
                // Identical narration is replayed constantly as children step back and forth.
                .cacheControl(CacheControl.maxAge(Duration.ofHours(6)).cachePrivate())
                .body(audio);
    }
}
