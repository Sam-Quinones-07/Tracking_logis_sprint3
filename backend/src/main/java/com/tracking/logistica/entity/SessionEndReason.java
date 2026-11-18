package com.tracking.logistica.entity;

/** Motivo por el que una sesión dejó de ser válida. */
public enum SessionEndReason {
    /** Pasaron más minutos de inactividad que los permitidos. */
    INACTIVIDAD("Tu sesión se cerró por inactividad. Inicia sesión de nuevo."),
    /** El usuario cerró sesión. */
    CERRADA("La sesión fue cerrada. Inicia sesión de nuevo."),
    /** Un administrador cambió el rol de la cuenta (HU-S-21). */
    ROL_CAMBIADO("Tu rol fue modificado por un administrador. Inicia sesión de nuevo para aplicar los nuevos permisos."),
    /** Token sin sesión asociada, vencido o alterado. */
    INVALIDA("Inicia sesión para continuar.");

    private final String message;

    SessionEndReason(String message) { this.message = message; }

    public String message() { return message; }
}
