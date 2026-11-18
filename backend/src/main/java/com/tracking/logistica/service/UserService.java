package com.tracking.logistica.service;

import com.tracking.logistica.dto.AccountSecurityResponse;
import com.tracking.logistica.dto.AuthResponse;
import com.tracking.logistica.dto.LoginRequest;
import com.tracking.logistica.dto.ProfileUpdateRequest;
import com.tracking.logistica.dto.RegisterRequest;
import com.tracking.logistica.dto.RegistrationResponse;
import com.tracking.logistica.dto.UserResponse;
import com.tracking.logistica.entity.Role;
import com.tracking.logistica.entity.SecurityEventType;
import com.tracking.logistica.entity.SessionEndReason;
import com.tracking.logistica.entity.User;
import com.tracking.logistica.entity.UserSession;
import com.tracking.logistica.exception.EmailNotVerifiedException;
import com.tracking.logistica.exception.ResourceAlreadyExistsException;
import com.tracking.logistica.exception.ResourceNotFoundException;
import com.tracking.logistica.repository.UserRepository;
import com.tracking.logistica.security.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class UserService {

    /** Mensaje único para correo inexistente y contraseña incorrecta: no revela qué cuentas existen. */
    static final String INVALID_CREDENTIALS = "Correo o contraseña incorrectos.";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final SessionService sessionService;
    private final SecurityAuditService audit;
    private final EmailVerificationService verificationService;
    private final String supportPhone;

    /** Hash BCrypt de relleno para igualar el tiempo de respuesta cuando el correo no existe. */
    private String dummyHash;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil,
                       SessionService sessionService, SecurityAuditService audit,
                       EmailVerificationService verificationService,
                       @Value("${app.contact.support-phone:}") String supportPhone) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.sessionService = sessionService;
        this.audit = audit;
        this.verificationService = verificationService;
        this.supportPhone = supportPhone == null ? "" : supportPhone.trim();
    }

    // ---------------------------------------------------------------- registro (HU-01, HU-S-21, HU-S-23)

    /**
     * Crea la cuenta como Cliente (el rol nunca se toma de la petición) y pendiente de verificación.
     * El usuario no puede iniciar sesión hasta abrir el enlace enviado a su correo.
     */
    @Transactional
    public RegistrationResponse register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        String identification = request.getIdentification().trim();

        if (userRepository.existsByEmail(email)) {
            throw new ResourceAlreadyExistsException("Ya existe una cuenta con el correo: " + email);
        }
        if (userRepository.existsByIdentification(identification)) {
            throw new ResourceAlreadyExistsException("Ya existe una cuenta con la identificación: " + identification);
        }

        User user = userRepository.save(User.builder()
                .email(email)
                .fullName(request.getFullName().trim())
                .identification(identification)
                .password(passwordEncoder.encode(request.getPassword()))
                .address(request.getAddress().trim())
                .cityCountry(request.getCityCountry().trim())
                .role(Role.CLIENTE)
                .emailVerified(false)
                .build());

        EmailVerificationService.Issued issued = verificationService.issue(user, false);
        return new RegistrationResponse(email, true,
                "Te enviamos un enlace a " + email + ". Ábrelo para activar tu cuenta (vence en 24 horas).",
                issued.devLink());
    }

    // ---------------------------------------------------------------- login (HU-02, HU-S-19, HU-S-22)

    private String dummyHash() {
        if (dummyHash == null) dummyHash = passwordEncoder.encode("relleno-para-igualar-tiempos");
        return dummyHash;
    }

    private String lockedMessage() {
        String base = "Tu cuenta está bloqueada por varios intentos fallidos.";
        return supportPhone.isEmpty()
                ? base + " Comunícate con soporte para que un administrador la desbloquee."
                : base + " Comunícate con soporte al " + supportPhone + " para que un administrador la desbloquee.";
    }

    @Transactional(noRollbackFor = {BadCredentialsException.class, EmailNotVerifiedException.class})
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmailForUpdate(request.getEmail().trim()).orElse(null);
        if (user == null) {
            passwordEncoder.matches(request.getPassword(), dummyHash());
            throw new BadCredentialsException(INVALID_CREDENTIALS);
        }
        LocalDateTime now = LocalDateTime.now();
        if (user.isAccountLocked()) throw new BadCredentialsException(lockedMessage());
        if (user.getPenaltyUntil() != null && now.isBefore(user.getPenaltyUntil())) {
            long seconds = Duration.between(now, user.getPenaltyUntil()).toSeconds() + 1;
            throw new BadCredentialsException("Por seguridad, espera " + seconds + " segundos antes de volver a intentarlo.");
        }
        if (user.getPenaltyUntil() != null) {
            user.setPenaltyUntil(null);
            user.setFailedLoginCount(0);
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            registerFailure(user, now);
        }
        user.setFailedLoginCount(0);
        user.setPenaltyLevel(0);
        user.setPenaltyUntil(null);
        userRepository.save(user);

        // Se comprueba después de la contraseña: así no se revela el estado de cuentas ajenas.
        if (user.isPendingVerification()) {
            throw new EmailNotVerifiedException("Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja o solicita un enlace nuevo.");
        }

        UserSession session = sessionService.open(user);
        return AuthResponse.builder()
                .token(jwtUtil.generateToken(user.getEmail(), session.getId()))
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .sessionTimeoutSeconds(sessionService.inactivitySeconds())
                .build();
    }

    /** Aplica la escalera de penalizaciones de HU-S-19 y siempre termina lanzando BadCredentialsException. */
    private void registerFailure(User user, LocalDateTime now) {
        int count = user.getFailedLoginCount() + 1;
        user.setFailedLoginCount(count);
        String message = INVALID_CREDENTIALS;
        if (user.getPenaltyLevel() == 0 && count >= 5) {
            user.setPenaltyUntil(now.plusMinutes(1)); user.setPenaltyLevel(1); user.setFailedLoginCount(0);
            audit.log(SecurityEventType.PENALIZACION, null, user.getEmail(), "5 intentos fallidos consecutivos: penalización de 1 minuto");
            message = "Se alcanzó el límite de intentos. Espera 1 minuto antes de volver a intentarlo.";
        } else if (user.getPenaltyLevel() == 1 && count >= 2) {
            user.setPenaltyUntil(now.plusMinutes(2)); user.setPenaltyLevel(2); user.setFailedLoginCount(0);
            audit.log(SecurityEventType.PENALIZACION, null, user.getEmail(), "2 intentos fallidos tras la primera penalización: penalización de 2 minutos");
            message = "Se alcanzó el siguiente límite de intentos. Espera 2 minutos antes de volver a intentarlo.";
        } else if (user.getPenaltyLevel() >= 2 && count >= 2) {
            user.setAccountLocked(true); user.setPenaltyUntil(null); user.setFailedLoginCount(0);
            audit.log(SecurityEventType.BLOQUEO, null, user.getEmail(), "2 intentos fallidos tras la segunda penalización: cuenta bloqueada");
            message = lockedMessage();
        }
        userRepository.save(user);
        throw new BadCredentialsException(message);
    }

    // ---------------------------------------------------------------- perfil (HU-03, HU-06)

    @Transactional(readOnly = true)
    public UserResponse getProfile(String email) {
        return mapToResponse(findByEmail(email));
    }

    /** Solo dirección y ciudad-país: correo, identificación y nombre no se pueden cambiar. */
    @Transactional
    public UserResponse updateProfile(String email, ProfileUpdateRequest request) {
        User user = findByEmail(email);
        user.setAddress(request.getAddress().trim());
        user.setCityCountry(request.getCityCountry().trim());
        return mapToResponse(userRepository.save(user));
    }

    private User findByEmail(String email) {
        return userRepository.findByEmail(email.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró el perfil de usuario."));
    }

    // ---------------------------------------------------------------- administración (HU-17, HU-S-19, HU-S-21)

    @Transactional(readOnly = true)
    public List<UserResponse> findAllUsers() {
        return userRepository.findAll().stream().map(this::mapToResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<UserResponse> findUsersWithShipments() {
        return userRepository.findUsersWithShipments().stream().map(this::mapToResponse).toList();
    }

    @Transactional
    public UserResponse updateRole(Long userId, String newRole, String adminEmail) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró usuario con ID: " + userId));

        Role role;
        try {
            role = Role.valueOf(newRole.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException e) {
            audit.log(SecurityEventType.ROL_RECHAZADO, adminEmail, user.getEmail(), "Rol no válido solicitado: " + newRole);
            throw new IllegalArgumentException("Rol no válido: " + newRole);
        }

        if (role == Role.ADMINISTRADOR || user.getRole() == Role.ADMINISTRADOR) {
            audit.log(SecurityEventType.ROL_RECHAZADO, adminEmail, user.getEmail(),
                    "Intento de asignar o modificar el rol Administrador (" + user.getRole() + " → " + role + ")");
            throw new IllegalArgumentException("No se puede asignar ni modificar el rol Administrador mediante este mecanismo");
        }

        if (role == user.getRole()) return mapToResponse(user);

        Role previous = user.getRole();
        user.setRole(role);
        User updated = userRepository.save(user);
        int closed = sessionService.revokeAll(user, SessionEndReason.ROL_CAMBIADO);
        audit.log(SecurityEventType.ROL_CAMBIADO, adminEmail, user.getEmail(),
                previous + " → " + role + " · sesiones cerradas: " + closed);
        return mapToResponse(updated);
    }

    @Transactional
    public UserResponse unlockAccount(Long userId, String adminEmail) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        boolean wasRestricted = user.isAccountLocked() || user.getPenaltyUntil() != null;
        user.setAccountLocked(false); user.setPenaltyLevel(0); user.setFailedLoginCount(0); user.setPenaltyUntil(null);
        User saved = userRepository.save(user);
        if (wasRestricted) {
            audit.log(SecurityEventType.DESBLOQUEO, adminEmail, user.getEmail(), "Cuenta desbloqueada por el administrador");
        }
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> findLockedUsers() {
        return userRepository.findByAccountLockedTrue().stream().map(this::mapToResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<AccountSecurityResponse> findAccountsUnderSecurityPenalty() {
        return userRepository.findUnderSecurityPenalty(LocalDateTime.now()).stream()
                .map(user -> AccountSecurityResponse.builder()
                        .id(user.getId()).email(user.getEmail()).fullName(user.getFullName())
                        .accountLocked(user.isAccountLocked()).penaltyUntil(user.getPenaltyUntil()).build())
                .toList();
    }

    private UserResponse mapToResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .identification(user.getIdentification())
                .address(user.getAddress())
                .cityCountry(user.getCityCountry())
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .emailVerified(!user.isPendingVerification())
                .build();
    }
}
