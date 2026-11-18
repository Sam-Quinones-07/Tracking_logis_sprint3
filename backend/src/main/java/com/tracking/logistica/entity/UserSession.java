package com.tracking.logistica.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Sesión iniciada en el servidor (HU-S-22). El JWT solo transporta el id de la sesión:
 * el servidor decide si sigue vigente (inactividad, cierre o cambio de rol).
 */
@Entity
@Table(name = "user_sessions", indexes = @Index(name = "idx_user_sessions_user", columnList = "user_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserSession {

    /** Identificador aleatorio (UUID), también es el "jti" del token. */
    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_activity_at", nullable = false)
    private LocalDateTime lastActivityAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "revoke_reason", length = 30)
    private SessionEndReason revokeReason;
}
