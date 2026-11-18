package com.tracking.logistica.service;

import com.tracking.logistica.dto.ReportDtos.*;
import com.tracking.logistica.entity.Shipment;
import com.tracking.logistica.entity.ShipmentEvent;
import com.tracking.logistica.entity.ShipmentStatus;
import com.tracking.logistica.entity.WeightCategory;
import com.tracking.logistica.repository.ShipmentEventRepository;
import com.tracking.logistica.repository.ShipmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Reportes del supervisor.
 *
 * <p>El documento de HU deja pendientes las reglas de HU-14 y HU-15. Se implementa esta
 * propuesta, explícita y configurable, para validarla con el cliente:</p>
 * <ul>
 *   <li><b>Tiempo de tránsito (HU-14):</b> desde el evento "Recibido en origen" hasta el evento
 *   "Entregado". Solo cuentan los envíos entregados que tienen ambos eventos. Además se muestra
 *   el promedio entre cada par de etapas consecutivas.</li>
 *   <li><b>Retraso (HU-15):</b> un envío sin entregar ni cancelar está retrasado si desde su
 *   evento "Recibido en origen" pasaron más horas que el límite de su categoría de peso
 *   ({@code app.delays.max-hours.*}).</li>
 * </ul>
 */
@Service
public class ReportService {

    private static final List<ShipmentStatus> FLOW = List.of(
            ShipmentStatus.RECIBIDO_EN_ORIGEN, ShipmentStatus.EN_CENTRAL, ShipmentStatus.EN_TRANSITO,
            ShipmentStatus.EN_REPARTO, ShipmentStatus.ENTREGADO);

    static final String TRANSIT_DEFINITION =
            "Tiempo entre el evento «Recibido en origen» y el evento «Entregado». Solo incluye envíos entregados.";

    private final ShipmentRepository shipments;
    private final ShipmentEventRepository events;
    private final Map<WeightCategory, Integer> limits;
    private final Clock clock;

    @Autowired
    public ReportService(ShipmentRepository shipments, ShipmentEventRepository events,
                         @Value("${app.delays.max-hours.pequeno:72}") int pequeno,
                         @Value("${app.delays.max-hours.mediano:72}") int mediano,
                         @Value("${app.delays.max-hours.grande:96}") int grande,
                         @Value("${app.delays.max-hours.extragrande:120}") int extragrande) {
        this(shipments, events, pequeno, mediano, grande, extragrande, Clock.systemDefaultZone());
    }

    ReportService(ShipmentRepository shipments, ShipmentEventRepository events,
                  int pequeno, int mediano, int grande, int extragrande, Clock clock) {
        this.shipments = shipments;
        this.events = events;
        EnumMap<WeightCategory, Integer> map = new EnumMap<>(WeightCategory.class);
        map.put(WeightCategory.PEQUENO, pequeno);
        map.put(WeightCategory.MEDIANO, mediano);
        map.put(WeightCategory.GRANDE, grande);
        map.put(WeightCategory.EXTRAGRANDE, extragrande);
        this.limits = Collections.unmodifiableMap(map);
        this.clock = clock;
    }

    /** Eventos agrupados por envío, conservando el orden cronológico. */
    private Map<Shipment, List<ShipmentEvent>> eventsByShipment() {
        Map<Shipment, List<ShipmentEvent>> grouped = new LinkedHashMap<>();
        for (ShipmentEvent e : events.findAllWithShipmentOrdered()) {
            grouped.computeIfAbsent(e.getShipment(), k -> new ArrayList<>()).add(e);
        }
        return grouped;
    }

    private static Optional<LocalDateTime> firstAt(List<ShipmentEvent> list, ShipmentStatus stage) {
        return list.stream().filter(e -> e.getStage() == stage).map(ShipmentEvent::getEventDateTime).findFirst();
    }

    private static double hoursBetween(LocalDateTime a, LocalDateTime b) {
        return Math.round(Duration.between(a, b).toMinutes() / 6.0) / 10.0; // horas con 1 decimal
    }

    @Transactional(readOnly = true)
    public TransitReport transitTimes() {
        List<TransitItem> items = new ArrayList<>();
        Map<ShipmentStatus, double[]> stageSums = new EnumMap<>(ShipmentStatus.class); // {suma, muestras}

        eventsByShipment().forEach((shipment, list) -> {
            Optional<LocalDateTime> received = firstAt(list, ShipmentStatus.RECIBIDO_EN_ORIGEN);
            Optional<LocalDateTime> delivered = firstAt(list, ShipmentStatus.ENTREGADO);
            if (received.isEmpty() || delivered.isEmpty()) return;

            items.add(new TransitItem(shipment.getTrackingId(), shipment.getRecipientName(), shipment.getWeightCategory(),
                    received.get(), delivered.get(), hoursBetween(received.get(), delivered.get())));

            for (int i = 0; i + 1 < FLOW.size(); i++) {
                Optional<LocalDateTime> from = firstAt(list, FLOW.get(i));
                Optional<LocalDateTime> to = firstAt(list, FLOW.get(i + 1));
                if (from.isPresent() && to.isPresent()) {
                    double[] acc = stageSums.computeIfAbsent(FLOW.get(i), k -> new double[2]);
                    acc[0] += Duration.between(from.get(), to.get()).toMinutes() / 60.0;
                    acc[1]++;
                }
            }
        });

        items.sort(Comparator.comparing(TransitItem::deliveredAt).reversed());
        List<StageAverage> stages = new ArrayList<>();
        for (int i = 0; i + 1 < FLOW.size(); i++) {
            double[] acc = stageSums.get(FLOW.get(i));
            if (acc != null && acc[1] > 0) {
                stages.add(new StageAverage(FLOW.get(i), FLOW.get(i + 1), Math.round(acc[0] / acc[1] * 10) / 10.0, (int) acc[1]));
            }
        }
        DoubleSummaryStatistics stats = items.stream().mapToDouble(TransitItem::hours).summaryStatistics();
        boolean any = !items.isEmpty();
        return new TransitReport(TRANSIT_DEFINITION, items.size(),
                any ? Math.round(stats.getAverage() * 10) / 10.0 : null,
                any ? stats.getMin() : null,
                any ? stats.getMax() : null,
                stages, items);
    }

    @Transactional(readOnly = true)
    public DelayReport delays() {
        LocalDateTime now = LocalDateTime.now(clock);
        List<DelayItem> items = new ArrayList<>();
        int[] evaluated = {0};

        eventsByShipment().forEach((shipment, list) -> {
            ShipmentStatus status = shipment.getStatus();
            if (status.isTerminal()) return;
            Optional<LocalDateTime> received = firstAt(list, ShipmentStatus.RECIBIDO_EN_ORIGEN);
            if (received.isEmpty()) return;
            evaluated[0]++;
            int limit = limits.get(shipment.getWeightCategory());
            double elapsed = hoursBetween(received.get(), now);
            if (elapsed > limit) {
                items.add(new DelayItem(shipment.getTrackingId(), shipment.getRecipientName(), shipment.getWeightCategory(),
                        status, received.get(), elapsed, limit, Math.round((elapsed - limit) * 10) / 10.0));
            }
        });

        items.sort(Comparator.comparingDouble(DelayItem::overHours).reversed());
        return new DelayReport(
                "Un envío está retrasado si sigue sin entregar y desde «Recibido en origen» pasó más tiempo que el límite de su categoría.",
                limits, evaluated[0], items);
    }

    @Transactional(readOnly = true)
    public VolumeSummary volume() {
        List<Shipment> all = shipments.findAll();
        Map<ShipmentStatus, Long> byStatus = new EnumMap<>(ShipmentStatus.class);
        for (ShipmentStatus s : ShipmentStatus.values()) byStatus.put(s, 0L);
        Map<WeightCategory, Long> byCategory = new EnumMap<>(WeightCategory.class);
        for (WeightCategory c : WeightCategory.values()) byCategory.put(c, 0L);

        LocalDate today = LocalDate.now(clock);
        Map<LocalDate, Long> perDay = new TreeMap<>();
        for (int i = 6; i >= 0; i--) perDay.put(today.minusDays(i), 0L);

        long active = 0;
        for (Shipment s : all) {
            byStatus.merge(s.getStatus(), 1L, Long::sum);
            byCategory.merge(s.getWeightCategory(), 1L, Long::sum);
            if (!s.getStatus().isTerminal()) active++;
            LocalDate day = s.getCreatedAt().toLocalDate();
            perDay.computeIfPresent(day, (d, c) -> c + 1);
        }
        List<DayCount> days = perDay.entrySet().stream().map(e -> new DayCount(e.getKey(), e.getValue())).toList();
        return new VolumeSummary(all.size(), active, byStatus, byCategory, days);
    }
}
