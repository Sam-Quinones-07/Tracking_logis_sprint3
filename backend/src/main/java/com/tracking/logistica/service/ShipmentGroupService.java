package com.tracking.logistica.service;

import com.tracking.logistica.dto.*;
import com.tracking.logistica.entity.*;
import com.tracking.logistica.exception.ResourceNotFoundException;
import com.tracking.logistica.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service @RequiredArgsConstructor
public class ShipmentGroupService {
    private final ShipmentGroupRepository groups;
    private final ShipmentRepository shipments;
    private final ShipmentEventRepository events;
    private final LogisticCenterRepository centers;
    private final UserRepository users;

    @Transactional
    public ShipmentGroupResponse create(ShipmentGroupRequest request, String email) {
        User operator = users.findByEmail(email).orElseThrow(() -> new ResourceNotFoundException("Operador no encontrado"));
        String name = request.getName().trim();
        // El nombre es único en la tabla, incluidos los grupos disueltos.
        if (groups.existsByNameIgnoreCase(name))
            throw new IllegalArgumentException("Ya existe un grupo con el nombre: " + name);
        Set<Shipment> selected = new LinkedHashSet<>();
        for (String id : new LinkedHashSet<>(request.getTrackingIds())) {
            Shipment shipment = shipments.findByTrackingIdForUpdate(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Envío no encontrado: " + id));
            if (shipment.getStatus().isTerminal())
                throw new IllegalArgumentException("No se puede incluir un envío terminal en un grupo: " + id);
            if (groups.existsByActiveTrueAndShipments_Id(shipment.getId()))
                throw new IllegalArgumentException("El envío " + id + " ya pertenece a un grupo activo");
            selected.add(shipment);
        }
        ShipmentGroup group = ShipmentGroup.builder().name(name).createdBy(operator).shipments(selected).build();
        return ShipmentGroupResponse.from(groups.save(group));
    }

    @Transactional(readOnly = true)
    public List<ShipmentGroupResponse> list() {
        return groups.findByActiveTrueOrderByCreatedAtDesc().stream().map(ShipmentGroupResponse::from).toList();
    }

    @Transactional
    public GroupEventResult apply(Long groupId, GroupEventRequest request, String email) {
        ShipmentGroup group = groups.findByIdForUpdate(groupId).orElseThrow(() -> new ResourceNotFoundException("Grupo no encontrado"));
        if (!group.isActive()) throw new IllegalArgumentException("El grupo ya fue disuelto");
        ShipmentStatus stage = request.getStage();
        if (stage == ShipmentStatus.ENTREGADO || stage == ShipmentStatus.CANCELADO)
            throw new IllegalArgumentException("Entregado y Cancelado solo se registran individualmente");
        User operator = users.findByEmail(email).orElseThrow(() -> new ResourceNotFoundException("Operador no encontrado"));
        Set<ShipmentStatus> networkStages = Set.of(ShipmentStatus.RECIBIDO_EN_ORIGEN, ShipmentStatus.EN_CENTRAL, ShipmentStatus.EN_TRANSITO);
        LogisticCenter center = null;
        String location;
        if (networkStages.contains(stage)) {
            if (request.getLogisticCenterId() == null) throw new IllegalArgumentException("Debe seleccionar un centro logístico");
            center = centers.findById(request.getLogisticCenterId()).orElseThrow(() -> new ResourceNotFoundException("Centro logístico no encontrado"));
            if (!center.isActive()) throw new IllegalArgumentException("El centro logístico seleccionado no está activo");
            location = center.getName() + " - " + center.getCity();
        } else if (stage == ShipmentStatus.EN_REPARTO) {
            location = "Dirección del destinatario";
        } else {
            throw new IllegalArgumentException("Etapa grupal no válida");
        }
        List<String> updated = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<Shipment> lockedShipments = new ArrayList<>();
        for (Shipment member : group.getShipments()) {
            Shipment shipment = shipments.findByTrackingIdForUpdate(member.getTrackingId())
                    .orElseThrow(() -> new ResourceNotFoundException("Envío no encontrado: " + member.getTrackingId()));
            lockedShipments.add(shipment);
            ShipmentStatus lastStage = events.findTopByShipmentIdOrderByEventDateTimeDescIdDesc(shipment.getId())
                    .map(ShipmentEvent::getStage).orElse(null);
            if (shipment.getStatus() != ShipmentStatus.currentFrom(lastStage)) {
                skipped.add(shipment.getTrackingId() + ": el estado actual no coincide con su historial");
                continue;
            }
            ShipmentStatus expected = ShipmentStatus.expectedAfter(lastStage);
            if (expected != stage) {
                skipped.add(shipment.getTrackingId() + ": siguiente etapa permitida " + (expected == null ? "ninguna (terminal)" : expected));
                continue;
            }
            String eventLocation = stage == ShipmentStatus.EN_REPARTO ? shipment.getRecipientAddress() : location;
            events.save(ShipmentEvent.builder().shipment(shipment).stage(stage)
                    .logisticCenter(stage == ShipmentStatus.EN_REPARTO ? null : center)
                    .location(eventLocation).registeredBy(operator).groupEvent(true)
                    .note("Aplicado desde grupo " + group.getName()).build());
            shipment.setStatus(stage);
            updated.add(shipment.getTrackingId());
        }
        shipments.saveAll(lockedShipments);
        return GroupEventResult.builder().updatedTrackingIds(updated).skippedReasons(skipped).build();
    }

    @Transactional
    public void dissolve(Long groupId) {
        ShipmentGroup group = groups.findByIdForUpdate(groupId).orElseThrow(() -> new ResourceNotFoundException("Grupo no encontrado"));
        if (!group.isActive()) throw new IllegalArgumentException("El grupo ya fue disuelto");
        group.setActive(false);
        groups.save(group);
    }
}
