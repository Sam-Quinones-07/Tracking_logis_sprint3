package com.tracking.logistica.service;

import com.tracking.logistica.entity.Role;
import com.tracking.logistica.entity.SessionEndReason;
import com.tracking.logistica.entity.User;
import com.tracking.logistica.entity.UserSession;
import com.tracking.logistica.repository.UserSessionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Sesiones con estado en el servidor (HU-S-22 y HU-S-21).
 * Una sesión deja de valer si pasan {@code app.session.inactivity-minutes} sin peticiones,
 * si el usuario la cierra o si un administrador cambia el rol de la cuenta.
 */
@Service
public class SessionService {

    /** Resultado de validar una sesión en cada petición. */
    public record Check(boolean valid, String email, Role role, SessionEndReason reason) {
        static Check ok(User user) { return new Check(true, user.getEmail(), user.getRole(), null); }
        static Check rejected(SessionEndReason reason) { return new Check(false, null, null, reason); }
    }

    /** No se escribe la última actividad en cada petición: basta con hacerlo cada 15 s. */
    private static final Duration TOUCH_INTERVAL = Duration.ofSeconds(15);

    private final UserSessionRepository repository;
    private final Duration inactivity;

    public SessionService(UserSessionRepository repository,
                          @Value("${app.session.inactivity-minutes:5}") long inactivityMinutes) {
        this.repository = repository;
        this.inactivity = Duration.ofMinutes(inactivityMinutes);
    }

    public long inactivitySeconds() {
        return inactivity.toSeconds();
    }

    @Transactional
    public UserSession open(User user) {
        LocalDateTime now = LocalDateTime.now();
        return repository.save(UserSession.builder()
                .id(UUID.randomUUID().toString()).user(user).createdAt(now).lastActivityAt(now).build());
    }

    /** Valida la sesión y registra actividad. La cierra si superó el tiempo de inactividad. */
    @Transactional
    public Check touch(String sessionId) {
        if (sessionId == null) return Check.rejected(SessionEndReason.INVALIDA);
        UserSession session = repository.findWithUser(sessionId).orElse(null);
        if (session == null) return Check.rejected(SessionEndReason.INVALIDA);
        if (session.getRevokedAt() != null) {
            return Check.rejected(session.getRevokeReason() == null ? SessionEndReason.INVALIDA : session.getRevokeReason());
        }
        LocalDateTime now = LocalDateTime.now();
        if (session.getLastActivityAt().plus(inactivity).isBefore(now)) {
            session.setRevokedAt(now);
            session.setRevokeReason(SessionEndReason.INACTIVIDAD);
            return Check.rejected(SessionEndReason.INACTIVIDAD);
        }
        if (Duration.between(session.getLastActivityAt(), now).compareTo(TOUCH_INTERVAL) >= 0) {
            session.setLastActivityAt(now);
        }
        return Check.ok(session.getUser());
    }

    @Transactional
    public void revoke(String sessionId, SessionEndReason reason) {
        repository.findById(sessionId).ifPresent(session -> {
            if (session.getRevokedAt() == null) {
                session.setRevokedAt(LocalDateTime.now());
                session.setRevokeReason(reason);
            }
        });
    }

    /** Invalida todas las sesiones activas de una cuenta (p. ej. tras un cambio de rol). */
    @Transactional
    public int revokeAll(User user, SessionEndReason reason) {
        return repository.revokeAllForUser(user.getId(), reason, LocalDateTime.now());
    }

    /** Borra sesiones sin actividad desde hace más de un día; ya no aportan información. */
    @Scheduled(cron = "${app.session.cleanup-cron:0 30 * * * *}")
    @Transactional
    public int purgeOld() {
        return repository.deleteInactiveBefore(LocalDateTime.now().minusDays(1));
    }
}
