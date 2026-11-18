package com.tracking.logistica.dto;

import com.tracking.logistica.entity.ShipmentStatus;
import com.tracking.logistica.entity.WeightCategory;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Respuestas de los reportes del supervisor (HU-14, HU-15, HU-16). */
public final class ReportDtos {

    private ReportDtos() {}

    // ---------- HU-14: tiempos de tránsito

    public record TransitItem(String trackingId, String recipientName, WeightCategory weightCategory,
                              LocalDateTime receivedAt, LocalDateTime deliveredAt, double hours) {}

    public record StageAverage(ShipmentStatus from, ShipmentStatus to, double averageHours, int samples) {}

    public record TransitReport(String definition, int count, Double averageHours, Double minHours, Double maxHours,
                                List<StageAverage> stageAverages, List<TransitItem> items) {}

    // ---------- HU-15: retrasos

    public record DelayItem(String trackingId, String recipientName, WeightCategory weightCategory,
                            ShipmentStatus status, LocalDateTime receivedAt, double elapsedHours,
                            int limitHours, double overHours) {}

    public record DelayReport(String rule, Map<WeightCategory, Integer> limitHours, int activeEvaluated,
                              List<DelayItem> items) {}

    // ---------- HU-16: volumen

    public record DayCount(LocalDate date, long count) {}

    public record VolumeSummary(long total, long active, Map<ShipmentStatus, Long> byStatus,
                                Map<WeightCategory, Long> byCategory, List<DayCount> last7Days) {}
}
