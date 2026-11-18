package com.tracking.logistica.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

/**
 * El token identifica una sesión del servidor (claim "jti"). No lleva el rol: el rol se
 * lee siempre de la cuenta en cada petición (HU-S-21).
 */
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expiration;

    public JwtUtil(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration:28800000}") long expiration) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiration = expiration;
    }

    public String generateToken(String email, String sessionId) {
        return Jwts.builder()
                .subject(email)
                .id(sessionId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(key)
                .compact();
    }

    /** Id de sesión si el token es auténtico y no venció; vacío en otro caso. */
    public Optional<String> sessionIdFrom(String token) {
        try {
            return Optional.ofNullable(getClaims(token).getId());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public String getEmailFromToken(String token) {
        return getClaims(token).getSubject();
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
