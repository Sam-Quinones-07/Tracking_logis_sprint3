package com.tracking.logistica.config;

import com.tracking.logistica.entity.Role;
import com.tracking.logistica.entity.User;
import com.tracking.logistica.entity.LogisticCenter;
import com.tracking.logistica.repository.UserRepository;
import com.tracking.logistica.repository.LogisticCenterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
@org.springframework.core.annotation.Order(1)
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final LogisticCenterRepository logisticCenterRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.email}")
    private String adminEmail;

    @Value("${app.admin.password}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        if (logisticCenterRepository.count() == 0) {
            logisticCenterRepository.saveAll(java.util.List.of(
                    LogisticCenter.builder().name("Centro de origen").city("Bogotá").address("Sede de origen").active(true).build(),
                    LogisticCenter.builder().name("Centro central").city("Bogotá").address("Sede central").active(true).build(),
                    LogisticCenter.builder().name("Centro regional").city("Medellín").address("Sede regional").active(true).build()));
        }
        ensureFixedAdmin();
    }

    /**
     * Administrador fijo ("quemado"): en cada arranque se crea si no existe y, si existe, se
     * restablecen su rol, su contraseña y su estado. Así nunca se pierde el acceso administrativo
     * aunque la cuenta se bloquee o se le cambie el rol o la clave.
     */
    private void ensureFixedAdmin() {
        String email = adminEmail.trim().toLowerCase(Locale.ROOT);
        User admin = userRepository.findByEmail(email).orElse(null);
        if (admin == null) {
            admin = User.builder()
                    .email(email)
                    .fullName("Administrador del Sistema")
                    .identification("ADMIN001")
                    .address("Sede principal")
                    .cityCountry("Medellín, Colombia")
                    .build();
            System.out.println(">>> Usuario administrador creado: " + email);
        }
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setRole(Role.ADMINISTRADOR);
        admin.setEmailVerified(true);
        admin.setAccountLocked(false);
        admin.setFailedLoginCount(0);
        admin.setPenaltyLevel(0);
        admin.setPenaltyUntil(null);
        userRepository.save(admin);
    }
}
