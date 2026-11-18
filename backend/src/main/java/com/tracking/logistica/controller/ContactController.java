package com.tracking.logistica.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * HU-18: canal de WhatsApp definido por la empresa. El número se configura en
 * {@code app.contact.whatsapp} (formato internacional, solo dígitos); si está vacío,
 * la interfaz informa que el canal no está disponible.
 */
@RestController
@RequestMapping("/api/contact")
public class ContactController {

    private final String whatsapp;
    private final String supportPhone;
    private final String hours;

    public ContactController(@Value("${app.contact.whatsapp:}") String whatsapp,
                             @Value("${app.contact.support-phone:}") String supportPhone,
                             @Value("${app.contact.hours:}") String hours) {
        this.whatsapp = whatsapp == null ? "" : whatsapp.replaceAll("[^0-9]", "");
        this.supportPhone = supportPhone == null ? "" : supportPhone.trim();
        this.hours = hours == null ? "" : hours.trim();
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> contact() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("whatsappAvailable", !whatsapp.isEmpty());
        body.put("whatsappNumber", whatsapp);
        body.put("supportPhone", supportPhone);
        body.put("hours", hours);
        return ResponseEntity.ok(body);
    }
}
