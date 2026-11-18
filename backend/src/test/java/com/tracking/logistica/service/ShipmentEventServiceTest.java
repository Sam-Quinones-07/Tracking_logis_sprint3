package com.tracking.logistica.service;

import com.tracking.logistica.dto.ShipmentEventRequest;
import com.tracking.logistica.entity.*;
import com.tracking.logistica.repository.LogisticCenterRepository;
import com.tracking.logistica.repository.ShipmentEventRepository;
import com.tracking.logistica.repository.ShipmentRepository;
import com.tracking.logistica.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ShipmentEventServiceTest {

    private final ShipmentEventRepository events = mock(ShipmentEventRepository.class);
    private final ShipmentRepository shipments = mock(ShipmentRepository.class);
    private final LogisticCenterRepository centers = mock(LogisticCenterRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ShipmentEventService service = new ShipmentEventService(events, shipments, centers, users);

    private final User operator = User.builder().id(1L).email("op@test.com").role(Role.OPERADOR_LOGISTICO).build();
    private final LogisticCenter center = LogisticCenter.builder().id(7L).name("Central").city("Bogotá").address("x").active(true).build();
    private Shipment shipment;

    @BeforeEach
    void setUp() {
        shipment = Shipment.builder().id(10L).trackingId("TRK-1").recipientAddress("Calle 1").build();
        when(users.findByEmail("op@test.com")).thenReturn(Optional.of(operator));
        when(shipments.findByTrackingIdForUpdate("TRK-1")).thenReturn(Optional.of(shipment));
        when(centers.findById(7L)).thenReturn(Optional.of(center));
        when(events.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private ShipmentEventRequest request(ShipmentStatus stage, Long centerId) {
        ShipmentEventRequest r = new ShipmentEventRequest();
        r.setTrackingId("TRK-1");
        r.setStage(stage);
        r.setLogisticCenterId(centerId);
        return r;
    }

    private void lastEvent(ShipmentStatus stage) {
        ShipmentEvent e = ShipmentEvent.builder().shipment(shipment).stage(stage).registeredBy(operator).build();
        when(events.findTopByShipmentIdOrderByEventDateTimeDescIdDesc(10L)).thenReturn(Optional.of(e));
    }

    @Test
    void envioNuevoRegistraPrimeroRecibidoEnOrigen() {
        when(events.findTopByShipmentIdOrderByEventDateTimeDescIdDesc(10L)).thenReturn(Optional.empty());

        service.registerEvent(request(ShipmentStatus.RECIBIDO_EN_ORIGEN, 7L), "op@test.com");

        assertThat(shipment.getStatus()).isEqualTo(ShipmentStatus.RECIBIDO_EN_ORIGEN);
        verify(events).save(any());
    }

    @Test
    void despuesDelPrimerEventoSePuedeAvanzar() {
        // Regresión: antes se comparaba el estado guardado con la siguiente etapa y el envío quedaba bloqueado.
        lastEvent(ShipmentStatus.RECIBIDO_EN_ORIGEN);

        service.registerEvent(request(ShipmentStatus.EN_CENTRAL, 7L), "op@test.com");

        assertThat(shipment.getStatus()).isEqualTo(ShipmentStatus.EN_CENTRAL);
    }

    @Test
    void rechazaSaltosDeEtapa() {
        lastEvent(ShipmentStatus.RECIBIDO_EN_ORIGEN);

        assertThatThrownBy(() -> service.registerEvent(request(ShipmentStatus.EN_TRANSITO, 7L), "op@test.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("EN_CENTRAL");
    }

    @Test
    void rechazaEventosTrasEtapaTerminal() {
        shipment.setStatus(ShipmentStatus.ENTREGADO);
        lastEvent(ShipmentStatus.ENTREGADO);

        assertThatThrownBy(() -> service.registerEvent(request(ShipmentStatus.ENTREGADO, null), "op@test.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("terminal");
    }
}
