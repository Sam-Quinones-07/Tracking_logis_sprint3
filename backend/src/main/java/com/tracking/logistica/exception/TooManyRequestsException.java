package com.tracking.logistica.exception;

public class TooManyRequestsException extends RuntimeException {
    public TooManyRequestsException(String message) { super(message); }
}
