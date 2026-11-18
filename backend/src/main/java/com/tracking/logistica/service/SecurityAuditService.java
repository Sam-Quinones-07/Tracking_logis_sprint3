package com.tracking.logistica.service;

import com.tracking.logistica.dto.SecurityEventResponse;
import com.tracking.logistica.entity.SecurityEvent;
import com.tracking.logistica.entity.SecurityEventType;
import com.tracking.logistica.repository.SecurityEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Registro de seguridad (HU-S-19, HU-S-20, HU-S-21, HU-S-23).
 * Cada evento se guarda en su propia transacción para que quede registrado
 * aunque la operación que lo originó termine con error (p. ej. un login rechazado).
 */
@Service
@RequiredArgsConstructor
public class SecurityAuditService {

    private final SecurityEventRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(SecurityEventType type, String actorEmail, String targetEmail, String detail) {
        repository.save(SecurityEvent.builder()
                .type(type).actorEmail(actorEmail).targetEmail(targetEmail).detail(detail)
                .build());
    }

    /** HU-S-20: consulta de tracking denegada (usuario, identificador, fecha y hora). */
    public void logDeniedTracking(String userEmail, String trackingId, String reason) {
        log(SecurityEventType.CONSULTA_DENEGADA, userEmail, null, "Seguimiento " + trackingId + " · " + reason);
    }

    @Transactional(readOnly = true)
    public List<SecurityEventResponse> recent(SecurityEventType type) {
        var events = type == null
                ? repository.findTop300ByOrderByCreatedAtDescIdDesc()
                : repository.findTop300ByTypeOrderByCreatedAtDescIdDesc(type);
        return events.stream().map(SecurityEventResponse::from).toList();
    }
}
