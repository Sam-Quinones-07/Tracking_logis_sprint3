package com.tracking.logistica.dto;

import com.tracking.logistica.entity.Shipment;
import com.tracking.logistica.entity.ShipmentGroup;
import java.time.LocalDateTime;
import java.util.List;

public record ShipmentGroupResponse(Long id, String name, boolean active, LocalDateTime createdAt, List<Member> shipments) {

    public record Member(String trackingId, String recipientName, String status) {
        static Member from(Shipment shipment) {
            return new Member(shipment.getTrackingId(), shipment.getRecipientName(), shipment.getStatus().name());
        }
    }

    /** Debe llamarse dentro de una transacción: recorre la colección perezosa de envíos. */
    public static ShipmentGroupResponse from(ShipmentGroup group) {
        return new ShipmentGroupResponse(group.getId(), group.getName(), group.isActive(), group.getCreatedAt(),
                group.getShipments().stream().map(Member::from).toList());
    }
}
