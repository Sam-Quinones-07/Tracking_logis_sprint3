package com.tracking.logistica.service;

import com.tracking.logistica.dto.LoginRequest;
import com.tracking.logistica.entity.Role;
import com.tracking.logistica.entity.SecurityEventType;
import com.tracking.logistica.entity.User;
import com.tracking.logistica.entity.UserSession;
import com.tracking.logistica.exception.EmailNotVerifiedException;
import com.tracking.logistica.repository.UserRepository;
import com.tracking.logistica.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class UserServiceLoginTest {

    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final JwtUtil jwt = new JwtUtil("clave-de-prueba-con-al-menos-32-bytes-de-largo!!", 60_000);
    private final SessionService sessions = mock(SessionService.class);
    private final SecurityAuditService audit = mock(SecurityAuditService.class);
    private final UserService service = new UserService(users, encoder, jwt, sessions, audit,
            mock(EmailVerificationService.class), "+57 300 000 0000");

    @BeforeEach
    void setUp() {
        when(sessions.open(any())).thenReturn(UserSession.builder().id("sesion-1").build());
        when(sessions.inactivitySeconds()).thenReturn(300L);
    }

    private User user() {
        return User.builder().id(1L).email("ana@test.com").fullName("Ana").identification("123")
                .password(encoder.encode("correcta123")).address("x").cityCountry("y").role(Role.CLIENTE)
                .emailVerified(true).build();
    }

    private LoginRequest login(String email, String password) {
        return new LoginRequest(email, password);
    }

    private void fail(int times) {
        for (int i = 0; i < times; i++) {
            assertThatThrownBy(() -> service.login(login("ana@test.com", "incorrecta1"))).isInstanceOf(BadCredentialsException.class);
        }
    }

    @Test
    void correoInexistenteYContrasenaIncorrectaDanElMismoMensaje() {
        when(users.findByEmailForUpdate("nadie@test.com")).thenReturn(Optional.empty());
        when(users.findByEmailForUpdate("ana@test.com")).thenReturn(Optional.of(user()));

        assertThatThrownBy(() -> service.login(login("nadie@test.com", "loquesea123")))
                .isInstanceOf(BadCredentialsException.class).hasMessage(UserService.INVALID_CREDENTIALS);
        assertThatThrownBy(() -> service.login(login("ana@test.com", "incorrecta1")))
                .isInstanceOf(BadCredentialsException.class).hasMessage(UserService.INVALID_CREDENTIALS);
    }

    @Test
    void cincoFallosAplicanPausaDeUnMinutoYQuedaRegistrada() {
        User ana = user();
        when(users.findByEmailForUpdate(anyString())).thenReturn(Optional.of(ana));

        fail(4);
        assertThatThrownBy(() -> service.login(login("ana@test.com", "incorrecta1"))).hasMessageContaining("1 minuto");
        assertThat(ana.getPenaltyLevel()).isEqualTo(1);
        assertThat(ana.getPenaltyUntil()).isNotNull();
        verify(audit).log(eq(SecurityEventType.PENALIZACION), isNull(), eq("ana@test.com"), contains("1 minuto"));

        // Durante la pausa ni siquiera la contraseña correcta permite entrar.
        assertThatThrownBy(() -> service.login(login("ana@test.com", "correcta123"))).hasMessageContaining("espera");
    }

    @Test
    void tercerNivelBloqueaLaCuentaEIndicaElNumeroDeSoporte() {
        User ana = user();
        ana.setPenaltyLevel(2);
        when(users.findByEmailForUpdate(anyString())).thenReturn(Optional.of(ana));

        fail(1);
        assertThatThrownBy(() -> service.login(login("ana@test.com", "incorrecta1")))
                .hasMessageContaining("bloqueada").hasMessageContaining("+57 300 000 0000");
        assertThat(ana.isAccountLocked()).isTrue();
        verify(audit).log(eq(SecurityEventType.BLOQUEO), isNull(), eq("ana@test.com"), anyString());

        // Bloqueada: la contraseña correcta tampoco sirve.
        assertThatThrownBy(() -> service.login(login("ana@test.com", "correcta123"))).hasMessageContaining("soporte");
    }

    @Test
    void loginCorrectoAbreSesionYReiniciaContadores() {
        User ana = user();
        ana.setFailedLoginCount(3);
        when(users.findByEmailForUpdate(anyString())).thenReturn(Optional.of(ana));

        var response = service.login(login("ana@test.com", "correcta123"));

        assertThat(jwt.getEmailFromToken(response.getToken())).isEqualTo("ana@test.com");
        assertThat(jwt.sessionIdFrom(response.getToken())).contains("sesion-1");
        assertThat(response.getSessionTimeoutSeconds()).isEqualTo(300);
        assertThat(ana.getFailedLoginCount()).isZero();
    }

    @Test
    void cuentaSinVerificarNoPuedeIniciarSesion() {
        User ana = user();
        ana.setEmailVerified(false);
        when(users.findByEmailForUpdate(anyString())).thenReturn(Optional.of(ana));

        assertThatThrownBy(() -> service.login(login("ana@test.com", "correcta123")))
                .isInstanceOf(EmailNotVerifiedException.class);
        verify(sessions, never()).open(any());
    }
}
