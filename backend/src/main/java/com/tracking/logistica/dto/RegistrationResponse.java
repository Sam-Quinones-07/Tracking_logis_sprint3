package com.tracking.logistica.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Respuesta del registro (HU-01 + HU-S-23). La cuenta queda pendiente de verificación.
 * {@code devVerificationLink} solo viene cuando no hay SMTP configurado (modo desarrollo).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RegistrationResponse(String email, boolean pendingVerification, String message, String devVerificationLink) {}
