package com.tracking.logistica.config;

import com.tracking.logistica.entity.*;
import com.tracking.logistica.repository.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Datos de ejemplo para desarrollo y demostraciones ({@code app.demo-data.enabled=true}).
 * Crea cuentas de cada rol y envíos con historial en fechas pasadas, de modo que las pantallas
 * de seguimiento, tiempos de tránsito, retrasos y volumen muestren información desde el inicio.
 * Nunca se activa en el perfil por defecto.
 */
@Component
@Order(2)
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.demo-data.enabled", havingValue = "true")
public class DemoDataInitializer implements CommandLineRunner {

    /** Contraseña compartida de las cuentas de ejemplo (documentada en el README). */
    static final String DEMO_PASSWORD = "Demo1234!";

    private static final Logger log = LoggerFactory.getLogger(DemoDataInitializer.class);

    private final UserRepository users;
    private final ShipmentRepository shipments;
    private final ShipmentEventRepository events;
    private final ShipmentGroupRepository groups;
    private final LogisticCenterRepository centers;
    private final SecurityEventRepository securityEvents;
    private final PasswordEncoder encoder;

    private LocalDateTime now;
    private List<LogisticCenter> network;
    private User operator;

    @Override
    @Transactional
    public void run(String... args) {
        if (users.existsByEmail("operador@demo.com")) return;
        now = LocalDateTime.now().withSecond(0).withNano(0);
        network = centers.findByActiveTrue();
        if (network.size() < 3) {
            log.warn("Datos de ejemplo omitidos: se necesitan al menos 3 centros logísticos activos");
            return;
        }

        String hash = encoder.encode(DEMO_PASSWORD);
        User laura = user("cliente@demo.com", "Laura Gómez", "1001234567", "Calle 50 # 45-20", "Medellín, Colombia", Role.CLIENTE, hash);
        User andres = user("cliente2@demo.com", "Andrés Pérez", "1002345678", "Carrera 7 # 72-10", "Bogotá, Colombia", Role.CLIENTE, hash);
        operator = user("operador@demo.com", "Marta Ruiz", "1003456789", "Sede central", "Bogotá, Colombia", Role.OPERADOR_LOGISTICO, hash);
        user("supervisor@demo.com", "Carlos Díaz", "1004567890", "Sede central", "Bogotá, Colombia", Role.SUPERVISOR_LOGISTICO, hash);
        User locked = user("bloqueado@demo.com", "Julián Rojas", "1005678901", "Avenida 80 # 30-15", "Cali, Colombia", Role.CLIENTE, hash);
        locked.setAccountLocked(true);
        locked.setPenaltyLevel(2);

        String sofiaId = "1009876543"; // destinataria sin cuenta en la plataforma

        // Entregados (alimentan HU-14).
        shipment("Tienda Andina", laura, WeightCategory.PEQUENO, 144, 0, 6, 20, 40, 46);
        shipment("Electro Hogar", andres, WeightCategory.GRANDE, 240, 0, 10, 30, 70, 80);
        shipment("Libros del Sur", andres, WeightCategory.MEDIANO, 96, 0, 3, 15, 26, 30);
        shipment("Moda Express", "Sofía Torres", sofiaId, "Calle 10 # 4-25, Cali", WeightCategory.MEDIANO, 192, 0, 8, 24, 50, 60);

        // En curso dentro del límite.
        shipment("Tienda Andina", laura, WeightCategory.PEQUENO, 24, 0, 4, 12, 20);
        shipment("Moda Express", "Sofía Torres", sofiaId, "Calle 10 # 4-25, Cali", WeightCategory.MEDIANO, 48, 0, 6, 20);

        // Retrasados según la regla propuesta (HU-15).
        shipment("Farmacia Central", laura, WeightCategory.PEQUENO, 120, 0, 5);
        shipment("Muebles Robles", andres, WeightCategory.EXTRAGRANDE, 168, 0, 12, 40);

        // Recién registrado, todavía sin eventos.
        shipment("Café de Origen", laura, WeightCategory.PEQUENO, 2);

        // Cancelado (HU-08).
        Shipment cancelled = shipment("Juguetería Feliz", laura, WeightCategory.MEDIANO, 72, 0);
        cancelled.setStatus(ShipmentStatus.CANCELADO);
        events.save(ShipmentEvent.builder().shipment(cancelled).stage(ShipmentStatus.CANCELADO)
                .location(cancelled.getRecipientAddress()).registeredBy(operator)
                .note("El remitente solicitó anular el envío").eventDateTime(now.minusHours(69)).build());

        // Dos envíos en central agrupados (HU-09 por lote).
        Shipment g1 = shipment("Tienda Andina", andres, WeightCategory.PEQUENO, 10, 0, 3);
        Shipment g2 = shipment("Libros del Sur", laura, WeightCategory.MEDIANO, 12, 0, 4);
        ShipmentGroup group = ShipmentGroup.builder().name("Lote Medellín").createdBy(operator).build();
        group.getShipments().add(g1);
        group.getShipments().add(g2);
        groups.save(group);

        securityEvents.save(SecurityEvent.builder().type(SecurityEventType.BLOQUEO).targetEmail(locked.getEmail())
                .detail("2 intentos fallidos tras la segunda penalización: cuenta bloqueada (dato de ejemplo)")
                .createdAt(now.minusHours(3)).build());

        log.info("Datos de ejemplo creados: 5 cuentas (contraseña {}) y {} envíos", DEMO_PASSWORD, shipments.count());
    }

    private User user(String email, String name, String id, String address, String city, Role role, String hash) {
        return users.save(User.builder().email(email).fullName(name).identification(id).password(hash)
                .address(address).cityCountry(city).role(role).emailVerified(true)
                .createdAt(now.minusDays(30)).build());
    }

    private Shipment shipment(String sender, User recipient, WeightCategory category, int hoursAgo, int... stageOffsets) {
        return shipment(sender, recipient.getFullName(), recipient.getIdentification(),
                recipient.getAddress() + ", " + recipient.getCityCountry(), category, hoursAgo, stageOffsets);
    }

    /**
     * Crea un envío registrado hace {@code hoursAgo} horas y le añade, en el orden del flujo,
     * un evento por cada desplazamiento (horas después del registro).
     */
    private Shipment shipment(String sender, String recipientName, String recipientId, String address,
                              WeightCategory category, int hoursAgo, int... stageOffsets) {
        LocalDateTime created = now.minusHours(hoursAgo);
        Shipment shipment = shipments.save(Shipment.builder()
                .senderCompanyName(sender).senderContactNumber("6045550000")
                .recipientName(recipientName).recipientIdentification(recipientId).recipientAddress(address)
                .weightCategory(category).createdBy(operator).createdAt(created).build());

        ShipmentStatus last = null;
        for (int offset : stageOffsets) {
            ShipmentStatus stage = ShipmentStatus.expectedAfter(last);
            LogisticCenter center = switch (stage) {
                case RECIBIDO_EN_ORIGEN -> network.get(0);
                case EN_CENTRAL -> network.get(1);
                case EN_TRANSITO -> network.get(2);
                default -> null;
            };
            events.save(ShipmentEvent.builder().shipment(shipment).stage(stage).logisticCenter(center)
                    .location(center == null ? address : center.getName() + " - " + center.getCity())
                    .registeredBy(operator).eventDateTime(created.plusHours(offset)).build());
            last = stage;
        }
        shipment.setStatus(ShipmentStatus.currentFrom(last));
        return shipments.save(shipment);
    }
}
