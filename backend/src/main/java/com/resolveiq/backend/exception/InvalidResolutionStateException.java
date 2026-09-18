package com.resolveiq.backend.exception;

/**
 * Thrown when resolution is requested for an investigation that is not yet in a
 * resolvable state (i.e. its status is not COMPLETED).
 */
public class InvalidResolutionStateException extends RuntimeException {

    public InvalidResolutionStateException(String message) {
        super(message);
    }
}
