package com.tracking.logistica.controller;

import com.tracking.logistica.dto.LogisticCenterResponse;
import com.tracking.logistica.dto.ReportDtos.DelayReport;
import com.tracking.logistica.dto.ReportDtos.TransitReport;
import com.tracking.logistica.dto.ReportDtos.VolumeSummary;
import com.tracking.logistica.dto.ShipmentResponse;
import com.tracking.logistica.dto.UserResponse;
import com.tracking.logistica.service.ReportService;
import com.tracking.logistica.service.ShipmentService;
import com.tracking.logistica.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/supervisor")
@RequiredArgsConstructor
public class SupervisorController {

    private final UserService userService;
    private final ShipmentService shipmentService;
    private final ReportService reportService;

    @GetMapping("/users-with-shipments")
    public ResponseEntity<List<UserResponse>> usersWithShipments() {
        return ResponseEntity.ok(userService.findUsersWithShipments());
    }

    @GetMapping("/logistic-centers")
    public ResponseEntity<List<LogisticCenterResponse>> logisticCenters() {
        return ResponseEntity.ok(shipmentService.getActiveCenters());
    }

    /** HU-16: cantidad total (se conserva por compatibilidad). */
    @GetMapping("/volume")
    public ResponseEntity<Long> volume() {
        return ResponseEntity.ok(reportService.volume().total());
    }

    /** HU-16: total más el desglose por estado, categoría y últimos 7 días. */
    @GetMapping("/volume/summary")
    public ResponseEntity<VolumeSummary> volumeSummary() {
        return ResponseEntity.ok(reportService.volume());
    }

    /** HU-14 */
    @GetMapping("/transit-times")
    public ResponseEntity<TransitReport> transitTimes() {
        return ResponseEntity.ok(reportService.transitTimes());
    }

    /** HU-15 */
    @GetMapping("/delays")
    public ResponseEntity<DelayReport> delays() {
        return ResponseEntity.ok(reportService.delays());
    }

    @GetMapping("/shipments/in-delivery")
    public ResponseEntity<List<ShipmentResponse>> shipmentsInDelivery() {
        return ResponseEntity.ok(shipmentService.getShipmentsInDelivery());
    }

    @GetMapping("/users/{identification}/shipments")
    public ResponseEntity<List<ShipmentResponse>> shipmentsByUser(@PathVariable String identification) {
        return ResponseEntity.ok(shipmentService.getShipmentsByRecipientIdentification(identification));
    }
}
