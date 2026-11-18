package com.tracking.logistica.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.tracking.logistica.entity.ShipmentEvent;

public interface ShipmentEventRepository extends JpaRepository<ShipmentEvent, Long> {
    // El id desempata eventos registrados en el mismo instante.
    List<ShipmentEvent> findByShipmentIdOrderByEventDateTimeAscIdAsc(Long shipmentId);
    Optional<ShipmentEvent> findTopByShipmentIdOrderByEventDateTimeDescIdDesc(Long shipmentId);
    boolean existsByShipmentId(Long shipmentId);

    /** Para los reportes del supervisor (HU-14, HU-15): todos los eventos con su envío, en orden. */
    @Query("select e from ShipmentEvent e join fetch e.shipment s order by s.id, e.eventDateTime, e.id")
    List<ShipmentEvent> findAllWithShipmentOrdered();
}
