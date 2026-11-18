package com.tracking.logistica.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String identification;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String address;

    @Column(name = "city_country", nullable = false)
    private String cityCountry;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private Role role = Role.CLIENTE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder.Default @Column(name = "failed_login_count", nullable = false)
    private int failedLoginCount = 0;

    @Column(name = "penalty_until")
    private LocalDateTime penaltyUntil;

    @Builder.Default @Column(name = "penalty_level", nullable = false)
    private int penaltyLevel = 0;

    @Builder.Default @Column(name = "account_locked", nullable = false)
    private boolean accountLocked = false;

    /**
     * HU-S-23. {@code false}: pendiente de verificación. {@code null} se trata como verificada
     * para no bloquear cuentas creadas antes de existir esta columna (la columna admite nulos
     * para que ddl-auto=update pueda añadirla a tablas con datos).
     */
    @Column(name = "email_verified")
    private Boolean emailVerified;

    public boolean isPendingVerification() {
        return Boolean.FALSE.equals(emailVerified);
    }

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) this.createdAt = LocalDateTime.now();
    }
}
