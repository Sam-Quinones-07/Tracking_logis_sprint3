import { useEffect, useState } from "react";
import { api, errorMessage, type CategoryCode, type DelayReport, type Shipment, type StatusCode, type TransitReport, type UserAccount, type VolumeSummary } from "../lib/api";
import type { PageProps } from "../lib/app";
import { CATEGORY, FLOW, STATUS, fmtHours, fmtShort } from "../lib/status";
import { Alert, BarList, Button, Card, CardHeader, ColumnChart, EmptyState, Icon, Loading, PageTitle, Stat, StatusBadge, Table } from "../components/ui";

function useApi<T>(path: string, token: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    setError("");
    api<T>(path, token).then(setData).catch((e) => setError(errorMessage(e, "No se pudo cargar la información.")));
  }, [path, token, version]);
  return { data, error, reload: () => setVersion((v) => v + 1) };
}

const STATUS_ORDER: StatusCode[] = [...FLOW, "CANCELADO"];
const dayFmt = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric" });

export function SupervisorDashboard({ token, go }: PageProps) {
  const volume = useApi<VolumeSummary>("/supervisor/volume/summary", token);
  const delays = useApi<DelayReport>("/supervisor/delays", token);
  const transit = useApi<TransitReport>("/supervisor/transit-times", token);
  return (
    <>
      <PageTitle eyebrow="Supervisión" title="Panel de supervisión" description="Indicadores de la operación calculados con los envíos y eventos registrados." />
      <div className="stats-grid four">
        <Stat label="Envíos registrados" value={volume.data?.total ?? "…"} icon="package" tone="blue" />
        <Stat label="En curso" value={volume.data?.active ?? "…"} icon="truck" tone="amber" />
        <Stat label="Con retraso" value={delays.data?.items.length ?? "…"} icon="warning" tone="red" hint="Según la regla propuesta" />
        <Stat label="Tránsito promedio" value={transit.data ? fmtHours(transit.data.averageHours) : "…"} icon="clock" tone="green" hint="Recibido → Entregado" />
      </div>
      <div className="dashboard-grid">
        <Card>
          <CardHeader title="Envíos por estado" action={<Button variant="ghost" size="sm" onClick={() => go("volume")}>Ver volumen</Button>} />
          {volume.data ? <BarList label="Envíos por estado" items={STATUS_ORDER.map((s) => ({ label: <span className="bar-label"><Icon name={STATUS[s].icon} size={16} /> {STATUS[s].label}</span>, value: volume.data!.byStatus[s] ?? 0, tone: STATUS[s].tone }))} /> : <Loading />}
        </Card>
        <Card>
          <CardHeader title="Retrasos más críticos" action={<Button variant="ghost" size="sm" onClick={() => go("delays")}>Ver todos</Button>} />
          {!delays.data ? <Loading /> : delays.data.items.length ? (
            <ul className="shipment-list compact">
              {delays.data.items.slice(0, 4).map((d) => (
                <li key={d.trackingId}><div><b className="mono">{d.trackingId}</b><span className="muted">{d.recipientName}</span></div><span className="over-tag">+{fmtHours(d.overHours)}</span></li>
              ))}
            </ul>
          ) : <EmptyState icon="check" title="Sin retrasos" description="Ningún envío supera el límite de su categoría." />}
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- HU-14

export function TransitTimes({ token, openTracking }: PageProps) {
  const { data, error, reload } = useApi<TransitReport>("/supervisor/transit-times", token);
  return (
    <>
      <PageTitle eyebrow="Indicador operativo" title="Tiempos de tránsito" description="Cuánto tarda un envío desde que se recibe en origen hasta que se entrega." action={<Button variant="secondary" icon="refresh" onClick={reload}>Actualizar</Button>} />
      <Alert tone="info" title="Regla propuesta (pendiente de validar con el cliente)">{data?.definition ?? "Tiempo entre «Recibido en origen» y «Entregado», solo para envíos entregados."}</Alert>
      {error && <Alert tone="error">{error}</Alert>}
      {!data ? !error && <Card><Loading /></Card> : data.count === 0 ? (
        <Card><EmptyState icon="clock" title="No hay información disponible" description="Todavía no hay envíos entregados con los eventos necesarios para calcular el tiempo de tránsito." /></Card>
      ) : (
        <>
          <div className="stats-grid four">
            <Stat label="Envíos analizados" value={data.count} icon="package" tone="blue" />
            <Stat label="Promedio" value={fmtHours(data.averageHours)} icon="clock" tone="purple" />
            <Stat label="Más rápido" value={fmtHours(data.minHours)} icon="arrow" tone="green" />
            <Stat label="Más lento" value={fmtHours(data.maxHours)} icon="warning" tone="amber" />
          </div>
          <div className="dashboard-grid">
            <Card>
              <CardHeader title="Detalle por envío" subtitle="Entregas más recientes primero" />
              <Table caption="Tiempo de tránsito por envío" headers={["Seguimiento", "Categoría", "Recibido", "Entregado", "Tiempo", ""]}>
                {data.items.map((i) => (
                  <tr key={i.trackingId}>
                    <td><strong className="mono">{i.trackingId}</strong><small className="block">{i.recipientName}</small></td>
                    <td>{CATEGORY[i.weightCategory]}</td>
                    <td>{fmtShort(i.receivedAt)}</td>
                    <td>{fmtShort(i.deliveredAt)}</td>
                    <td><b>{fmtHours(i.hours)}</b></td>
                    <td><Button variant="ghost" size="sm" onClick={() => openTracking(i.trackingId)} ariaLabel={`Ver ${i.trackingId}`}>Ver</Button></td>
                  </tr>
                ))}
              </Table>
            </Card>
            <Card>
              <CardHeader title="Promedio entre etapas" subtitle="Dónde se va el tiempo" />
              <BarList label="Horas promedio entre etapas consecutivas" items={data.stageAverages.map((s) => ({ label: `${STATUS[s.from].label} → ${STATUS[s.to].label}`, value: Math.round(s.averageHours * 10) / 10, hint: "h", tone: STATUS[s.to].tone }))} />
            </Card>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- HU-15

export function Delays({ token, openTracking }: PageProps) {
  const { data, error, reload } = useApi<DelayReport>("/supervisor/delays", token);
  return (
    <>
      <PageTitle eyebrow="Excepciones" title="Envíos con retraso" description="Envíos sin entregar que superan el tiempo máximo de su categoría." action={<Button variant="secondary" icon="refresh" onClick={reload}>Actualizar</Button>} />
      {error && <Alert tone="error">{error}</Alert>}
      {data && (
        <Card className="rule-card">
          <div><h2 className="card-title">Regla propuesta (pendiente de validar con el cliente)</h2><p className="muted">{data.rule}</p></div>
          <ul className="limit-list" aria-label="Límite por categoría">
            {(Object.keys(data.limitHours) as CategoryCode[]).map((c) => <li key={c}><span>{CATEGORY[c]}</span><b>{data.limitHours[c]} h</b></li>)}
          </ul>
        </Card>
      )}
      {!data ? !error && <Card><Loading /></Card> : data.items.length === 0 ? (
        <Card><EmptyState icon="check" title="No hay envíos retrasados" description={`Se revisaron ${data.activeEvaluated} envíos en curso y ninguno supera el límite.`} /></Card>
      ) : (
        <Card>
          <CardHeader title={`${data.items.length} ${data.items.length === 1 ? "envío retrasado" : "envíos retrasados"}`} subtitle={`De ${data.activeEvaluated} envíos en curso. Ordenados por exceso de tiempo.`} />
          <Table caption="Envíos retrasados" headers={["Seguimiento", "Estado actual", "Categoría", "Recibido", "Transcurrido", "Exceso", ""]}>
            {data.items.map((d) => (
              <tr key={d.trackingId}>
                <td><strong className="mono">{d.trackingId}</strong><small className="block">{d.recipientName}</small></td>
                <td><StatusBadge status={d.status} /></td>
                <td>{CATEGORY[d.weightCategory]}<small className="block">Límite {d.limitHours} h</small></td>
                <td>{fmtShort(d.receivedAt)}</td>
                <td>{fmtHours(d.elapsedHours)}</td>
                <td><span className="over-tag"><Icon name="warning" size={14} /> +{fmtHours(d.overHours)}</span></td>
                <td><Button variant="ghost" size="sm" onClick={() => openTracking(d.trackingId)} ariaLabel={`Ver ${d.trackingId}`}>Ver</Button></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------- HU-16

export function Volume({ token }: PageProps) {
  const { data, error, reload } = useApi<VolumeSummary>("/supervisor/volume/summary", token);
  return (
    <>
      <PageTitle eyebrow="Operación consolidada" title="Volumen de envíos" description="Cantidad total de envíos registrados y su distribución." action={<Button variant="secondary" icon="refresh" onClick={reload}>Actualizar</Button>} />
      {error && <Alert tone="error">{error}</Alert>}
      {!data ? !error && <Card><Loading /></Card> : (
        <>
          <div className="volume-hero">
            <div><span>Envíos registrados en total</span><b>{data.total.toLocaleString("es-CO")}</b><small>{data.active} en curso · {data.total - data.active} terminados</small></div>
            <Icon name="chart" size={64} />
          </div>
          <div className="dashboard-grid three">
            <Card>
              <CardHeader title="Registrados en los últimos 7 días" />
              <ColumnChart label="Envíos registrados por día" items={data.last7Days.map((d) => ({ label: dayFmt.format(new Date(`${d.date}T12:00:00`)), value: d.count }))} />
            </Card>
            <Card>
              <CardHeader title="Por estado" />
              <BarList label="Envíos por estado" items={STATUS_ORDER.map((s) => ({ label: <span className="bar-label"><Icon name={STATUS[s].icon} size={16} /> {STATUS[s].label}</span>, value: data.byStatus[s] ?? 0, tone: STATUS[s].tone }))} />
            </Card>
            <Card>
              <CardHeader title="Por categoría de peso" />
              <BarList label="Envíos por categoría" items={(Object.keys(CATEGORY) as CategoryCode[]).map((c) => ({ label: CATEGORY[c], value: data.byCategory[c] ?? 0, tone: "blue" }))} />
            </Card>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- HU-13

export function SupervisorUsers({ token, openTracking }: PageProps) {
  const users = useApi<UserAccount[]>("/supervisor/users-with-shipments", token);
  const [selected, setSelected] = useState<UserAccount | null>(null);
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [error, setError] = useState("");
  const open = async (u: UserAccount) => {
    setSelected(u); setShipments(null); setError("");
    try { setShipments(await api<Shipment[]>(`/supervisor/users/${encodeURIComponent(u.identification)}/shipments`, token)); }
    catch (e) { setError(errorMessage(e, "No se pudieron cargar los envíos.")); setShipments([]); }
  };
  return (
    <>
      <PageTitle eyebrow="Consulta" title="Envíos por usuario" description="Usuarios cuya identificación coincide con la de algún destinatario." />
      <div className="dashboard-grid">
        <Card>
          <CardHeader title="Usuarios con envíos" />
          {!users.data ? <Loading /> : users.data.length ? (
            <ul className="user-list">
              {users.data.map((u) => (
                <li key={u.id}>
                  <button className={selected?.id === u.id ? "user-row active" : "user-row"} onClick={() => void open(u)} aria-pressed={selected?.id === u.id}>
                    <span className="mini-avatar" aria-hidden="true">{u.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                    <span><b>{u.fullName}</b><small>CC {u.identification} · {u.email}</small></span>
                    <Icon name="chevron" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="people" title="No hay usuarios con envíos" description="Aparecerán cuando se registren envíos a nombre de usuarios con cuenta." />}
        </Card>
        <Card>
          {!selected ? <EmptyState icon="people" title="Selecciona un usuario" description="Verás sus envíos y su estado actual." /> : (
            <>
              <CardHeader title={`Envíos de ${selected.fullName}`} subtitle={`Identificación ${selected.identification}`} />
              {error && <Alert tone="error">{error}</Alert>}
              {!shipments ? <Loading /> : shipments.length ? (
                <ul className="shipment-list">
                  {shipments.map((s) => (
                    <li key={s.trackingId}>
                      <div><b className="mono">{s.trackingId}</b><span className="muted">{fmtShort(s.createdAt)}</span></div>
                      <StatusBadge status={s.status} />
                      <Button variant="secondary" size="sm" onClick={() => openTracking(s.trackingId)} ariaLabel={`Ver ${s.trackingId}`}>Ver</Button>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon="package" title="Sin envíos" description="Este usuario no tiene envíos." />}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
