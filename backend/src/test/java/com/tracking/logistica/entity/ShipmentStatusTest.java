package com.tracking.logistica.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ShipmentStatusTest {

    @Test
    void sinEventosLaPrimeraEtapaEsRecibidoEnOrigen() {
        assertThat(ShipmentStatus.expectedAfter(null)).isEqualTo(ShipmentStatus.RECIBIDO_EN_ORIGEN);
        assertThat(ShipmentStatus.currentFrom(null)).isEqualTo(ShipmentStatus.RECIBIDO_EN_ORIGEN);
    }

    @Test
    void lasEtapasAvanzanEnOrden() {
        assertThat(ShipmentStatus.expectedAfter(ShipmentStatus.RECIBIDO_EN_ORIGEN)).isEqualTo(ShipmentStatus.EN_CENTRAL);
        assertThat(ShipmentStatus.expectedAfter(ShipmentStatus.EN_CENTRAL)).isEqualTo(ShipmentStatus.EN_TRANSITO);
        assertThat(ShipmentStatus.expectedAfter(ShipmentStatus.EN_TRANSITO)).isEqualTo(ShipmentStatus.EN_REPARTO);
        assertThat(ShipmentStatus.expectedAfter(ShipmentStatus.EN_REPARTO)).isEqualTo(ShipmentStatus.ENTREGADO);
    }

    @Test
    void lasEtapasTerminalesNoTienenSiguiente() {
        assertThat(ShipmentStatus.expectedAfter(ShipmentStatus.ENTREGADO)).isNull();
        assertThat(ShipmentStatus.expectedAfter(ShipmentStatus.CANCELADO)).isNull();
        assertThat(ShipmentStatus.ENTREGADO.isTerminal()).isTrue();
        assertThat(ShipmentStatus.CANCELADO.isTerminal()).isTrue();
        assertThat(ShipmentStatus.EN_REPARTO.isTerminal()).isFalse();
    }
}
