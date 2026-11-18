package com.tracking.logistica.dto;

import com.tracking.logistica.entity.LogisticCenter;

public record LogisticCenterResponse(Long id, String name, String city, String address) {
    public static LogisticCenterResponse from(LogisticCenter center) {
        return new LogisticCenterResponse(center.getId(), center.getName(), center.getCity(), center.getAddress());
    }
}
