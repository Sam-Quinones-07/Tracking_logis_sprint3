package com.tracking.logistica.controller;

import com.tracking.logistica.dto.*;
import com.tracking.logistica.entity.SessionEndReason;
import com.tracking.logistica.security.JwtUtil;
import com.tracking.logistica.service.EmailVerificationService;
import com.tracking.logistica.service.SessionService;
import com.tracking.logistica.service.UserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    public record VerifyRequest(@NotBlank(message = "El código de verificación es obligatorio") String token) {}

    public record ResendRequest(@NotBlank(message = "El correo electrónico es obligatorio")
                                @Email(message = "El formato del correo electrónico no es válido") String email) {}

    private final UserService userService;
    private final EmailVerificationService verificationService;
    private final SessionService sessionService;
    private final JwtUtil jwtUtil;

    @PostMapping("/register")
    public ResponseEntity<RegistrationResponse> register(@Valid @RequestBody RegisterRequest request) {
        return new ResponseEntity<>(userService.register(request), HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(userService.login(request));
    }

    /** HU-S-23: activa la cuenta. 200 si se verificó, 400 con el motivo (vencido, usado, reemplazado o inválido). */
    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verify(@Valid @RequestBody VerifyRequest request) {
        EmailVerificationService.VerifyResult result = verificationService.verify(request.token());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("outcome", result.outcome());
        body.put("message", result.message());
        if (result.email() != null) body.put("email", result.email());
        boolean ok = result.outcome() == EmailVerificationService.Outcome.VERIFICADO;
        return ResponseEntity.status(ok ? HttpStatus.OK : HttpStatus.BAD_REQUEST).body(body);
    }

    /** HU-S-23: nuevo enlace (invalida el anterior). Respuesta neutra para no revelar qué correos existen. */
    @PostMapping("/resend-verification")
    public ResponseEntity<Map<String, Object>> resend(@Valid @RequestBody ResendRequest request) {
        EmailVerificationService.Issued issued = verificationService.resend(request.email());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Si la cuenta existe y está pendiente de verificación, enviamos un enlace nuevo. Los enlaces anteriores dejan de funcionar.");
        if (issued.devLink() != null) body.put("devVerificationLink", issued.devLink());
        return ResponseEntity.ok(body);
    }

    /** HU-S-22: invalida la sesión en el servidor; el token deja de servir aunque alguien lo haya guardado. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            jwtUtil.sessionIdFrom(authorization.substring(7))
                    .ifPresent(id -> sessionService.revoke(id, SessionEndReason.CERRADA));
        }
        return ResponseEntity.noContent().build();
    }
}
