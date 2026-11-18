package com.tracking.logistica.controller;

import com.tracking.logistica.dto.*;
import com.tracking.logistica.service.ShipmentGroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/operador/groups") @RequiredArgsConstructor
public class ShipmentGroupController {
    private final ShipmentGroupService service;

    @GetMapping
    public ResponseEntity<List<ShipmentGroupResponse>> list() {
        return ResponseEntity.ok(service.list());
    }

    @PostMapping
    public ResponseEntity<ShipmentGroupResponse> create(@Valid @RequestBody ShipmentGroupRequest request, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request, auth.getName()));
    }

    @PostMapping("/{groupId}/events")
    public ResponseEntity<GroupEventResult> apply(@PathVariable Long groupId, @Valid @RequestBody GroupEventRequest request, Authentication auth) {
        return ResponseEntity.ok(service.apply(groupId, request, auth.getName()));
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> dissolve(@PathVariable Long groupId) {
        service.dissolve(groupId);
        return ResponseEntity.noContent().build();
    }
}
