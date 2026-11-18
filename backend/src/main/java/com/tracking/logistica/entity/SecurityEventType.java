package com.tracking.logistica.entity;

/** Tipos de evento del registro de seguridad. */
public enum SecurityEventType {
    /** HU-S-19: pausa temporal tras intentos fallidos. */
    PENALIZACION,
    /** HU-S-19: bloqueo hasta desbloqueo administrativo. */
    BLOQUEO,
    /** HU-S-19: un administrador retiró una pausa o bloqueo. */
    DESBLOQUEO,
    /** HU-S-20: consulta de un envío denegada. */
    CONSULTA_DENEGADA,
    /** HU-S-21: un administrador cambió el rol de una cuenta. */
    ROL_CAMBIADO,
    /** HU-S-21: intento de asignar o cambiar un rol rechazado. */
    ROL_RECHAZADO,
    /** HU-S-23: una cuenta confirmó su correo electrónico. */
    CORREO_VERIFICADO
}
