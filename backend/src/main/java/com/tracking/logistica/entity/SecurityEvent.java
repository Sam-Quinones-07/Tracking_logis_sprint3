package com.tracking.logistica.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Registro de seguridad. Guarda correos como texto (no claves foráneas) para que el
 * registro se conserve aunque la cuenta se elimine.
 */
@Entity
@Table(name = "security_events", indexes = @Index(name = "idx_security_events_created", columnList = "created_at"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SecurityEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private SecurityEventType type;

    /** Quién realizó la acción (nulo si fue el sistema). */
    @Column(name = "actor_email")
    private String actorEmail;

    /** Cuenta afectada. */
    @Column(name = "target_email")
    private String targetEmail;

    @Column(length = 500)
    private String detail;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
