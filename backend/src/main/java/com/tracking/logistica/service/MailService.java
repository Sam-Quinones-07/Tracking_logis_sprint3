package com.tracking.logistica.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Envío de correos. Si hay servidor SMTP configurado ({@code spring.mail.host}) se envía de
 * verdad; si no, el sistema funciona en "modo desarrollo": el correo se escribe en el log y el
 * enlace se devuelve a la interfaz para poder completar el flujo sin buzón real.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender sender;
    private final String from;

    public MailService(ObjectProvider<JavaMailSender> senderProvider,
                       @Value("${app.mail.from:no-reply@trackline.local}") String from) {
        this.sender = senderProvider.getIfAvailable();
        this.from = from;
    }

    /** true cuando no hay SMTP: los correos no salen del servidor. */
    public boolean isDevMode() {
        return sender == null;
    }

    public void send(String to, String subject, String body) {
        if (sender == null) {
            log.info("[MODO DESARROLLO - correo no enviado] Para: {} | Asunto: {}\n{}", to, subject, body);
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        sender.send(message);
    }
}
