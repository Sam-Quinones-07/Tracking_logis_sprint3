package com.tracking.logistica.dto;

import com.tracking.logistica.entity.SecurityEvent;
import com.tracking.logistica.entity.SecurityEventType;
import java.time.LocalDateTime;

public record SecurityEventResponse(Long id, SecurityEventType type, String actorEmail, String targetEmail,
                                    String detail, LocalDateTime createdAt) {
    public static SecurityEventResponse from(SecurityEvent e) {
        return new SecurityEventResponse(e.getId(), e.getType(), e.getActorEmail(), e.getTargetEmail(), e.getDetail(), e.getCreatedAt());
    }
}
