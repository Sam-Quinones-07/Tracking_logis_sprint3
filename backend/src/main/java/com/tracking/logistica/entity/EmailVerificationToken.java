package com.tracking.logistica.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Enlace de verificación de correo (HU-S-23). Solo se guarda el hash SHA-256 del código:
 * quien lea la base de datos no puede reconstruir enlaces válidos.
 */
@Entity
@Table(name = "email_verification_tokens")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EmailVerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    /** Se marca cuando se solicita un enlace nuevo: el anterior deja de servir. */
    @Column(name = "invalidated_at")
    private LocalDateTime invalidatedAt;

    /** true si se generó por una solicitud de reenvío (cuenta para el límite por hora). */
    @Column(nullable = false)
    private boolean resend;
}
