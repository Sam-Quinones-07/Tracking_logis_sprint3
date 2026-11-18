package com.tracking.logistica.entity;

public enum ShipmentStatus {
    RECIBIDO_EN_ORIGEN,
    EN_CENTRAL,
    EN_TRANSITO,
    EN_REPARTO,
    ENTREGADO,
    CANCELADO;

    public boolean isTerminal() {
        return this == ENTREGADO || this == CANCELADO;
    }

    /**
     * Estado que debe tener guardado un envío según su último evento. Un envío recién
     * creado (sin eventos) está en RECIBIDO_EN_ORIGEN.
     */
    public static ShipmentStatus currentFrom(ShipmentStatus lastStage) {
        return lastStage == null ? RECIBIDO_EN_ORIGEN : lastStage;
    }

    /**
     * Etapa que corresponde registrar después de {@code lastStage}.
     * Las transiciones son explícitas para no depender del orden de declaración del enum.
     *
     * @param lastStage etapa del último evento registrado, o {@code null} si el envío no tiene eventos
     * @return la siguiente etapa permitida, o {@code null} si {@code lastStage} es terminal
     */
    public static ShipmentStatus expectedAfter(ShipmentStatus lastStage) {
        if (lastStage == null) return RECIBIDO_EN_ORIGEN;
        return switch (lastStage) {
            case RECIBIDO_EN_ORIGEN -> EN_CENTRAL;
            case EN_CENTRAL -> EN_TRANSITO;
            case EN_TRANSITO -> EN_REPARTO;
            case EN_REPARTO -> ENTREGADO;
            case ENTREGADO, CANCELADO -> null;
        };
    }
}
