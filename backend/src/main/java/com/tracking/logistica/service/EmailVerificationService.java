package com.tracking.logistica.service;

import com.tracking.logistica.entity.EmailVerificationToken;
import com.tracking.logistica.entity.SecurityEventType;
import com.tracking.logistica.entity.User;
import com.tracking.logistica.exception.TooManyRequestsException;
import com.tracking.logistica.repository.EmailVerificationTokenRepository;
import com.tracking.logistica.repository.UserRepository;
import com.tracking.logistica.repository.UserSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

/**
 * HU-S-23: verificación del correo al registrarse.
 * <ul>
 *   <li>Código aleatorio de 256 bits (no deriva del correo ni de la identificación).</li>
 *   <li>Un solo uso y vence a las 24 horas.</li>
 *   <li>Pedir uno nuevo invalida el anterior; máximo 3 reenvíos por hora por cuenta.</li>
 *   <li>Las cuentas sin verificar se eliminan a los 7 días, liberando correo e identificación.</li>
 * </ul>
 */
@Service
public class EmailVerificationService {

    public enum Outcome { VERIFICADO, VENCIDO, USADO, REEMPLAZADO, INVALIDO }

    public record VerifyResult(Outcome outcome, String email, String message) {}

    /** Enlace en texto claro, solo para devolverlo a la interfaz cuando no hay SMTP. */
    public record Issued(String devLink) {}

    static final int TOKEN_HOURS = 24;
    static final int MAX_RESENDS_PER_HOUR = 3;
    static final int UNVERIFIED_DAYS = 7;

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final EmailVerificationTokenRepository tokens;
    private final UserRepository users;
    private final UserSessionRepository sessions;
    private final MailService mail;
    private final SecurityAuditService audit;
    private final String frontendUrl;

    public EmailVerificationService(EmailVerificationTokenRepository tokens, UserRepository users,
                                    UserSessionRepository sessions, MailService mail, SecurityAuditService audit,
                                    @Value("${app.frontend-url:http://localhost:8443}") String frontendUrl) {
        this.tokens = tokens;
        this.users = users;
        this.sessions = sessions;
        this.mail = mail;
        this.audit = audit;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    /** Genera un enlace nuevo (invalidando los anteriores) y lo envía por correo. */
    @Transactional
    public Issued issue(User user, boolean resend) {
        LocalDateTime now = LocalDateTime.now();
        tokens.invalidateActive(user.getId(), now);

        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        tokens.save(EmailVerificationToken.builder()
                .user(user).tokenHash(hash(token)).createdAt(now).expiresAt(now.plusHours(TOKEN_HOURS)).resend(resend)
                .build());

        String link = frontendUrl + "/?verificar=" + token;
        mail.send(user.getEmail(), "Confirma tu correo en Trackline",
                "Hola " + user.getFullName() + ",\n\n"
                        + "Para activar tu cuenta de Trackline abre este enlace:\n" + link + "\n\n"
                        + "El enlace sirve una sola vez y vence en " + TOKEN_HOURS + " horas.\n"
                        + "Si no creaste esta cuenta, ignora este mensaje: se eliminará en " + UNVERIFIED_DAYS + " días.");
        return new Issued(mail.isDevMode() ? link : null);
    }

    @Transactional
    public VerifyResult verify(String token) {
        if (token == null || token.isBlank()) {
            return new VerifyResult(Outcome.INVALIDO, null, "El enlace de verificación no es válido.");
        }
        EmailVerificationToken stored = tokens.findByHashWithUser(hash(token.trim())).orElse(null);
        if (stored == null) {
            return new VerifyResult(Outcome.INVALIDO, null, "El enlace de verificación no es válido. Revisa que lo copiaste completo o solicita uno nuevo.");
        }
        String email = stored.getUser().getEmail();
        if (stored.getUsedAt() != null) {
            return new VerifyResult(Outcome.USADO, email, "Este enlace ya fue usado. Si tu cuenta ya está activa, inicia sesión.");
        }
        if (stored.getInvalidatedAt() != null) {
            return new VerifyResult(Outcome.REEMPLAZADO, email, "Este enlace fue reemplazado por uno más reciente. Usa el último enlace que recibiste o solicita uno nuevo.");
        }
        LocalDateTime now = LocalDateTime.now();
        if (stored.getExpiresAt().isBefore(now)) {
            return new VerifyResult(Outcome.VENCIDO, email, "Este enlace venció (dura " + TOKEN_HOURS + " horas). Solicita uno nuevo.");
        }
        // Actualización condicional: si dos peticiones llegan a la vez, solo una activa la cuenta.
        if (tokens.markUsed(stored.getId(), now) == 0) {
            return new VerifyResult(Outcome.USADO, email, "Este enlace ya fue usado. Si tu cuenta ya está activa, inicia sesión.");
        }
        stored.getUser().setEmailVerified(true);
        audit.log(SecurityEventType.CORREO_VERIFICADO, email, email, "Cuenta activada mediante enlace de verificación");
        return new VerifyResult(Outcome.VERIFICADO, email, "Tu correo quedó verificado. Ya puedes iniciar sesión.");
    }

    /**
     * Reenvía el enlace. Responde lo mismo exista o no la cuenta (no revela qué correos están
     * registrados); solo el límite de reenvíos produce un error explícito.
     */
    @Transactional
    public Issued resend(String email) {
        User user = users.findByEmail(email.trim().toLowerCase(Locale.ROOT)).orElse(null);
        if (user == null || !user.isPendingVerification()) return new Issued(null);
        long recent = tokens.countByUserIdAndResendTrueAndCreatedAtAfter(user.getId(), LocalDateTime.now().minusHours(1));
        if (recent >= MAX_RESENDS_PER_HOUR) {
            throw new TooManyRequestsException("Alcanzaste el máximo de " + MAX_RESENDS_PER_HOUR
                    + " reenvíos por hora. Espera un momento antes de solicitar otro enlace.");
        }
        return issue(user, true);
    }

    /** Cada hora elimina las cuentas que no se verificaron en 7 días. */
    @Scheduled(cron = "${app.verification.cleanup-cron:0 0 * * * *}")
    @Transactional
    public int deleteExpiredUnverifiedAccounts() {
        List<User> expired = users.findByEmailVerifiedFalseAndCreatedAtBefore(LocalDateTime.now().minusDays(UNVERIFIED_DAYS));
        for (User user : expired) {
            tokens.deleteAllForUser(user.getId());
            sessions.deleteAllForUser(user.getId());
            users.delete(user);
        }
        if (!expired.isEmpty()) log.info("Eliminadas {} cuentas sin verificar tras {} días", expired.size(), UNVERIFIED_DAYS);
        return expired.size();
    }

    static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
