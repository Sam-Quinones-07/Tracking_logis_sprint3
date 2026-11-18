package com.tracking.logistica.controller;

import com.tracking.logistica.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * HU-S-22: el frontend avisa de la actividad del usuario (clics, teclado) aunque no haga
 * otras peticiones, para que el servidor —que es quien decide— no cierre una sesión en uso.
 * La propia petición renueva la actividad en JwtAuthenticationFilter.
 */
@RestController
@RequestMapping("/api/session")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @PostMapping("/heartbeat")
    public ResponseEntity<Map<String, Long>> heartbeat() {
        return ResponseEntity.ok(Map.of("inactivitySeconds", sessionService.inactivitySeconds()));
    }
}
