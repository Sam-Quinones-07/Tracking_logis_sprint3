package com.tracking.logistica.exception;

/** HU-S-23: credenciales correctas, pero la cuenta aún no confirmó su correo. */
public class EmailNotVerifiedException extends RuntimeException {
    public EmailNotVerifiedException(String message) { super(message); }
}
