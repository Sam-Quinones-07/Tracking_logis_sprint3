package com.tracking.logistica.security;

import com.tracking.logistica.entity.SecurityEventType;
import com.tracking.logistica.entity.SessionEndReason;
import com.tracking.logistica.service.SecurityAuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.regex.Pattern;

/**
 * Respuestas JSON para 401 (sin sesión válida) y 403 (sin permiso), con el mismo formato que
 * GlobalExceptionHandler. El 401 incluye el motivo para que el frontend explique por qué se
 * cerró la sesión (HU-S-22).
 */
@Component
@RequiredArgsConstructor
public class JsonSecurityHandlers {

    private static final Pattern ROLE_CHANGE = Pattern.compile("^/api/admin/users/[^/]+/role$");

    private final SecurityAuditService audit;

    public AuthenticationEntryPoint entryPoint() {
        return (request, response, ex) -> {
            Object attr = request.getAttribute(JwtAuthenticationFilter.REJECTION_ATTRIBUTE);
            SessionEndReason reason = attr instanceof SessionEndReason r ? r : SessionEndReason.INVALIDA;
            write(response, 401, reason.message(), reason.name());
        };
    }

    public AccessDeniedHandler accessDeniedHandler() {
        return (request, response, ex) -> {
            // HU-S-21: intento de cambiar un rol sin ser administrador, aunque se envíe la petición directamente.
            if (ROLE_CHANGE.matcher(request.getRequestURI()).matches()) {
                var auth = SecurityContextHolder.getContext().getAuthentication();
                audit.log(SecurityEventType.ROL_RECHAZADO, auth == null ? null : auth.getName(), null,
                        "Intento de cambiar un rol sin permisos de administrador (" + request.getMethod() + " "
                                + request.getRequestURI() + describeRole(request) + ")");
            }
            write(response, 403, "No tienes permiso para realizar esta acción.", "FORBIDDEN");
        };
    }

    private static String describeRole(HttpServletRequest request) {
        String role = request.getParameter("role");
        return role == null ? "" : ", rol solicitado " + role;
    }

    private static void write(HttpServletResponse response, int status, String message, String code) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.getWriter().write("{\"timestamp\":\"" + LocalDateTime.now() + "\",\"status\":" + status
                + ",\"error\":\"" + message.replace("\"", "'") + "\",\"code\":\"" + code + "\"}");
    }
}
