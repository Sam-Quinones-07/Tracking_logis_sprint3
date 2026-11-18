package com.tracking.logistica.security;

import com.tracking.logistica.entity.SessionEndReason;
import com.tracking.logistica.service.SessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Autentica cada petición a partir de la sesión del servidor: el token debe ser auténtico
 * y su sesión debe seguir activa. El rol se toma de la cuenta, nunca del token ni del navegador.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** Atributo de la petición con el motivo de rechazo, para el mensaje del 401. */
    public static final String REJECTION_ATTRIBUTE = "trackline.session.rejection";

    private final JwtUtil jwtUtil;
    private final SessionService sessionService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String sessionId = jwtUtil.sessionIdFrom(header.substring(7)).orElse(null);
            SessionService.Check check = sessionId == null
                    ? new SessionService.Check(false, null, null, SessionEndReason.INVALIDA)
                    : sessionService.touch(sessionId);

            if (check.valid()) {
                var auth = new UsernamePasswordAuthenticationToken(
                        check.email(), null, List.of(new SimpleGrantedAuthority("ROLE_" + check.role().name())));
                auth.setDetails(sessionId);
                SecurityContextHolder.getContext().setAuthentication(auth);
            } else {
                request.setAttribute(REJECTION_ATTRIBUTE, check.reason());
            }
        }

        filterChain.doFilter(request, response);
    }
}
