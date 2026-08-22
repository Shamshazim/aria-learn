package com.mathtutor.setup;

import com.mathtutor.auth.Parent;
import com.mathtutor.auth.ParentRepository;
import com.mathtutor.auth.Role;
import com.mathtutor.auth.security.JwtService;
import com.mathtutor.common.BadRequestException;
import com.mathtutor.common.ForbiddenException;
import com.mathtutor.setup.dto.SetupDtos.CreateParentRequest;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SetupServiceTest {

    private final ParentRepository parentRepo = mock(ParentRepository.class);
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private final JwtService jwtService = mock(JwtService.class);
    private final SetupService service = new SetupService(parentRepo, encoder, jwtService);

    @Test
    void reportsUnconfiguredWhenNoParentExists() {
        when(parentRepo.count()).thenReturn(0L);
        assertThat(service.isConfigured()).isFalse();
    }

    @Test
    void reportsConfiguredOnceAParentExists() {
        when(parentRepo.count()).thenReturn(1L);
        assertThat(service.isConfigured()).isTrue();
    }

    @Test
    void createsFirstParentAndReturnsSignedInTokens() {
        when(parentRepo.count()).thenReturn(0L);
        when(jwtService.generateAccessToken(any(), any(), any())).thenReturn("access-token");
        when(jwtService.generateRefreshToken(any(), any())).thenReturn("refresh-token");

        var tokens = service.createFirstParent(new CreateParentRequest("mum", "correct horse battery"));

        assertThat(tokens.accessToken()).isEqualTo("access-token");
        assertThat(tokens.refreshToken()).isEqualTo("refresh-token");
        assertThat(tokens.role()).isEqualTo(Role.PARENT);
        assertThat(tokens.displayName()).isEqualTo("mum");
        verify(parentRepo).save(any(Parent.class));
    }

    @Test
    void storesPasswordAsABcryptHashNeverPlainText() {
        when(parentRepo.count()).thenReturn(0L);
        when(parentRepo.save(any(Parent.class))).thenAnswer(inv -> {
            Parent saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });

        service.createFirstParent(new CreateParentRequest("dad", "a-secret-password"));

        var captor = org.mockito.ArgumentCaptor.forClass(Parent.class);
        verify(parentRepo).save(captor.capture());
        String hash = captor.getValue().getPasswordHash();

        assertThat(hash).doesNotContain("a-secret-password");
        assertThat(hash).startsWith("$2");
        assertThat(encoder.matches("a-secret-password", hash)).isTrue();
    }

    /** The whole security model of this endpoint rests on this test. */
    @Test
    void refusesToCreateASecondParent() {
        when(parentRepo.count()).thenReturn(1L);

        assertThatThrownBy(() -> service.createFirstParent(new CreateParentRequest("intruder", "password123")))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("already has a parent account");

        verify(parentRepo, never()).save(any());
    }

    @Test
    void rejectsUsernamesContainingSpaces() {
        when(parentRepo.count()).thenReturn(0L);

        assertThatThrownBy(() -> service.createFirstParent(new CreateParentRequest("mum smith", "password123")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cannot contain spaces");

        verify(parentRepo, never()).save(any());
    }

    @Test
    void trimsSurroundingWhitespaceFromTheUsername() {
        when(parentRepo.count()).thenReturn(0L);
        var captor = org.mockito.ArgumentCaptor.forClass(Parent.class);

        service.createFirstParent(new CreateParentRequest("  mum  ", "password123"));

        verify(parentRepo).save(captor.capture());
        assertThat(captor.getValue().getEmail()).isEqualTo("mum");
    }
}
