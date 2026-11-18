import { useEffect, useState } from "react";
import { api, errorMessage, type Center, type Group, type Shipment, type ShipmentEvent, type StatusCode } from "../lib/api";
import type { PageProps } from "../lib/app";
import { FLOW, STATUS, TERMINAL, fmtShort, nextStageAfter, statusLabel } from "../lib/status";
import { Alert, BarList, Button, Card, CardHeader, EmptyState, Icon, Input, Loading, Modal, PageTitle, Pipeline, Select, Stat, StatusBadge, Table } from "../components/ui";

const ADDRESS_STAGES: StatusCode[] = ["EN_REPARTO", "ENTREGADO"];

export function OperatorDashboard({ token, go, openTracking }: PageProps) {
  const [rows, setRows] = useState<Shipment[] | null>(null);
  useEffect(() => { api<Shipment[]>("/operador/shipments", token).then(setRows).catch(() => setRows([])); }, [token]);
  const count = (s: StatusCode) => rows?.filter((r) => r.status === s).length ?? 0;
  const active = rows?.filter((r) => !TERMINAL.includes(r.status)) ?? [];
  return (
    <>
      <PageTitle eyebrow="Operación" title="Resumen operativo" description="Estado de los envíos y accesos rápidos a las tareas del día."
        action={<><Button variant="secondary" icon="truck" onClick={() => go("event")}>Registrar evento</Button><Button icon="plus" onClick={() => go("new")}>Registrar envío</Button></>} />
      <div className="stats-grid four">
        <Stat label="Envíos en curso" value={rows ? active.length : "…"} icon="package" tone="blue" />
        <Stat label="En tránsito" value={rows ? count("EN_TRANSITO") : "…"} icon="truck" tone="amber" />
        <Stat label="En reparto" value={rows ? count("EN_REPARTO") : "…"} icon="pin" tone="teal" />
        <Stat label="Entregados" value={rows ? count("ENTREGADO") : "…"} icon="check" tone="green" />
      </div>
      <div className="dashboard-grid">
        <Card>
          <CardHeader title="En reparto ahora" subtitle="Pendientes de registrar la entrega" />
          {!rows ? <Loading /> : count("EN_REPARTO") ? (
            <ul className="shipment-list">
              {rows.filter((r) => r.status === "EN_REPARTO").map((s) => (
                <li key={s.trackingId}>
                  <div><b className="mono">{s.trackingId}</b><span className="muted">{s.recipientName} · {s.recipientAddress}</span></div>
                  <StatusBadge status={s.status} />
                  <Button variant="secondary" size="sm" onClick={() => openTracking(s.trackingId)} ariaLabel={`Ver ${s.trackingId}`}>Ver</Button>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="pin" title="No hay envíos en reparto" description="Aparecerán cuando registres la etapa En reparto." />}
        </Card>
        <Card>
          <CardHeader title="Envíos por etapa" />
          {rows ? <BarList label="Cantidad de envíos por etapa" items={[...FLOW, "CANCELADO" as StatusCode].map((s) => ({ label: <span className="bar-label"><Icon name={STATUS[s].icon} size={16} /> {STATUS[s].label}</span>, value: count(s), tone: STATUS[s].tone }))} /> : <Loading />}
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- HU-07

export function NewShipment({ token, notify, openTracking }: PageProps) {
  const empty = { senderCompanyName: "", senderContactNumber: "", recipientName: "", recipientIdentification: "", recipientAddress: "" };
  const [form, setForm] = useState(empty);
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Shipment | null>(null);
  const [error, setError] = useState("");
  const set = (k: keyof typeof empty) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const num = Number(weight);
  const weightInvalid = weight !== "" && (!Number.isFinite(num) || num <= 0 || num > 2000);
  const category = !weight || weightInvalid ? null : num <= 20 ? "Pequeño" : num <= 40 ? "Mediano" : num <= 70 ? "Grande" : "Extragrande";
  const idInvalid = form.recipientIdentification !== "" && !/^[0-9]{1,10}$/.test(form.recipientIdentification);
  const incomplete = Object.values(form).some((v) => !v.trim()) || !weight;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await api<Shipment>("/operador/shipments", token, { method: "POST", body: JSON.stringify({ ...form, weight: num }) });
      setCreated(result); setForm(empty); setWeight("");
      notify(`Envío ${result.trackingId} registrado.`);
    } catch (err) { setError(errorMessage(err, "No fue posible registrar el envío.")); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageTitle eyebrow="Gestión de envíos" title="Registrar envío" description="El servidor genera el identificador de seguimiento y guarda solo la categoría del peso." />
      {created && (
        <div className="success-banner" role="status">
          <Icon name="check" size={26} />
          <div><b>Envío registrado: <span className="mono">{created.trackingId}</span></b><span>{created.message ?? "Comparte este identificador con el destinatario. El siguiente paso es registrar su recepción en origen."}</span></div>
          <Button variant="secondary" size="sm" onClick={() => openTracking(created.trackingId)}>Ver seguimiento</Button>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <div className="form-layout">
          <Card>
            <h2 className="section-title">Remitente</h2>
            <div className="form-grid two">
              <Input label="Empresa remitente" value={form.senderCompanyName} onChange={set("senderCompanyName")} required />
              <Input label="Teléfono de contacto" value={form.senderContactNumber} onChange={set("senderContactNumber")} required inputMode="numeric" />
            </div>
            <div className="divider-line" />
            <h2 className="section-title">Destinatario</h2>
            <div className="form-grid two">
              <Input label="Nombre completo" value={form.recipientName} onChange={set("recipientName")} required />
              <Input label="Identificación" value={form.recipientIdentification} onChange={set("recipientIdentification")} required inputMode="numeric" error={idInvalid ? "Solo números, máximo 10 dígitos." : undefined} helper="Con este número el cliente verá el envío en su cuenta." />
            </div>
            <Input label="Dirección de entrega" value={form.recipientAddress} onChange={set("recipientAddress")} required />
            <div className="divider-line" />
            <h2 className="section-title">Paquete</h2>
            <div className="form-grid two">
              <Input label="Peso (lb)" type="number" value={weight} onChange={setWeight} required inputMode="decimal" error={weightInvalid ? "Ingresa un peso mayor a 0 y hasta 2000 lb." : undefined} />
              <div className={`category-result ${category ? "" : "pending"}`} aria-live="polite">
                <span>Categoría calculada</span><b>{category ?? "Ingresa el peso"}</b>
              </div>
            </div>
            {category === "Extragrande" && <Alert tone="warning" title="Envío extragrande">Tendrá un tratamiento diferente, pero sigue las mismas etapas.</Alert>}
            {error && <Alert tone="error">{error}</Alert>}
          </Card>
          <aside>
            <Card className="summary-card">
              <h2 className="card-title">Rangos de categoría</h2>
              <ul className="range-list">
                <li><span>Pequeño</span><b>hasta 20 lb</b></li>
                <li><span>Mediano</span><b>20 – 40 lb</b></li>
                <li><span>Grande</span><b>40 – 70 lb</b></li>
                <li><span>Extragrande</span><b>70 – 2000 lb</b></li>
              </ul>
              <Button type="submit" size="lg" busy={busy} disabled={incomplete || weightInvalid || idInvalid}>Registrar envío</Button>
            </Card>
          </aside>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------- HU-09

export function EventRegistration({ token, notify }: PageProps) {
  const [code, setCode] = useState("");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [history, setHistory] = useState<ShipmentEvent[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<Center[]>("/operador/centers", token).then(setCenters).catch(() => setCenters([])); }, [token]);

  const lastStage = history.length ? history[history.length - 1].stage : null;
  const next = shipment ? nextStageAfter(lastStage) : null;
  const needsCenter = next !== null && !ADDRESS_STAGES.includes(next);

  const find = async (raw = code) => {
    setError("");
    const enc = encodeURIComponent(raw.trim().toUpperCase());
    if (!enc) return;
    try {
      const [s, h] = await Promise.all([api<Shipment>(`/tracking/${enc}`, token), api<ShipmentEvent[]>(`/tracking/${enc}/events`, token)]);
      setShipment(s); setHistory(h); setCenterId("");
    } catch (e) { setShipment(null); setHistory([]); setError(errorMessage(e, "No se encontró el envío.")); }
  };

  const save = async () => {
    if (!shipment || !next) return;
    setBusy(true); setError("");
    try {
      await api("/operador/shipment-events", token, { method: "POST", body: JSON.stringify({ trackingId: shipment.trackingId, stage: next, logisticCenterId: needsCenter ? Number(centerId) : null }) });
      notify(`${shipment.trackingId}: se registró «${statusLabel(next)}».`);
      await find(shipment.trackingId);
    } catch (e) { setError(errorMessage(e, "No se pudo registrar el evento.")); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageTitle eyebrow="Trazabilidad" title="Registrar evento logístico" description="La siguiente etapa se calcula a partir del último evento: no se pueden saltar, repetir ni devolver etapas." />
      <Card>
        <form className="event-query" onSubmit={(e) => { e.preventDefault(); void find(); }}>
          <Input label="Identificador de seguimiento" value={code} onChange={setCode} placeholder="TRK-…" autoComplete="off" />
          <Button type="submit" variant="secondary" icon="search">Buscar</Button>
        </form>
        {error && <Alert tone="error">{error}</Alert>}
      </Card>
      {shipment && (
        <Card>
          <CardHeader title={`Envío ${shipment.trackingId}`} subtitle={`${shipment.recipientName} · ${shipment.recipientAddress}`} action={<StatusBadge status={shipment.status} large />} />
          <Pipeline status={shipment.status} lastStageBeforeCancel={[...history].reverse().find((e) => e.stage !== "CANCELADO")?.stage ?? null} />
          <div className="divider-line" />
          {next ? (
            <>
              <div className="next-stage">
                <span className="muted">Siguiente etapa</span>
                <StatusBadge status={next} large />
                {!lastStage && <span className="muted small">El envío aún no tiene eventos: lo primero es registrar su recepción en origen.</span>}
              </div>
              <div className="form-grid two">
                {needsCenter
                  ? <Select label="Centro logístico" value={centerId} onChange={setCenterId}><option value="">Selecciona un centro</option>{centers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}</Select>
                  : <Input label="Lugar" value={shipment.recipientAddress} disabled helper="En reparto y Entregado usan la dirección del destinatario." />}
              </div>
              <div className="form-actions"><Button busy={busy} disabled={needsCenter && !centerId} onClick={save} icon="check">Registrar «{statusLabel(next)}»</Button></div>
            </>
          ) : <Alert tone="info" title="El envío terminó su recorrido">{shipment.status === "CANCELADO" ? "Está cancelado" : "Ya fue entregado"}; no admite más eventos.</Alert>}
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------- HU-03 (grupos)

export function Groups({ token, notify }: PageProps) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [choices, setChoices] = useState<Record<number, { stage: StatusCode; centerId: string }>>({});
  const choice = (id: number) => choices[id] ?? { stage: "EN_CENTRAL" as StatusCode, centerId: "" };
  const setChoice = (id: number, patch: Partial<{ stage: StatusCode; centerId: string }>) => setChoices((p) => ({ ...p, [id]: { ...choice(id), ...patch } }));

  const refresh = () => {
    api<Group[]>("/operador/groups", token).then(setGroups).catch((e) => { setGroups([]); notify(errorMessage(e, "No se pudieron cargar los grupos."), "error"); });
    api<Shipment[]>("/operador/shipments", token).then(setShipments).catch(() => {});
  };
  useEffect(() => { refresh(); api<Center[]>("/operador/centers", token).then(setCenters).catch(() => {}); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = new Set((groups ?? []).flatMap((g) => g.shipments.map((s) => s.trackingId)));
  const eligible = shipments.filter((s) => !TERMINAL.includes(s.status) && !grouped.has(s.trackingId));

  const create = async () => {
    try { await api("/operador/groups", token, { method: "POST", body: JSON.stringify({ name, trackingIds: selected }) }); setModal(false); setName(""); setSelected([]); notify("Grupo creado."); refresh(); }
    catch (e) { notify(errorMessage(e, "No se pudo crear el grupo."), "error"); }
  };
  const apply = async (id: number) => {
    const { stage, centerId } = choice(id);
    try {
      const r = await api<{ updatedTrackingIds: string[]; skippedReasons: string[] }>(`/operador/groups/${id}/events`, token, { method: "POST", body: JSON.stringify({ stage, logisticCenterId: stage === "EN_REPARTO" ? null : Number(centerId) }) });
      notify(`Actualizados: ${r.updatedTrackingIds.length}. Omitidos: ${r.skippedReasons.length ? r.skippedReasons.join("; ") : "ninguno"}.`);
      refresh();
    } catch (e) { notify(errorMessage(e, "No se pudo aplicar el evento."), "error"); }
  };
  const dissolve = async (id: number) => {
    try { await api(`/operador/groups/${id}`, token, { method: "DELETE" }); notify("Grupo disuelto. Los historiales se conservan."); refresh(); }
    catch (e) { notify(errorMessage(e, "No se pudo disolver el grupo."), "error"); }
  };

  return (
    <>
      <PageTitle eyebrow="Operación por lote" title="Grupos de paquetes" description="Registra la misma etapa para varios envíos a la vez. Entregado y Cancelado se registran uno por uno."
        action={<Button icon="plus" onClick={() => setModal(true)}>Crear grupo</Button>} />
      {!groups ? <Card><Loading /></Card> : groups.length ? (
        <div className="group-grid">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardHeader title={g.name} subtitle={`${g.shipments.length} envíos · creado ${fmtShort(g.createdAt)}`} action={<Button variant="ghost" size="sm" onClick={() => void dissolve(g.id)}>Disolver</Button>} />
              <Table caption={`Envíos del grupo ${g.name}`} headers={["Seguimiento", "Destinatario", "Estado"]}>
                {g.shipments.map((s) => <tr key={s.trackingId}><td className="mono">{s.trackingId}</td><td>{s.recipientName}</td><td><StatusBadge status={s.status} /></td></tr>)}
              </Table>
              <div className="form-grid two group-controls">
                <Select label="Etapa a registrar" value={choice(g.id).stage} onChange={(v) => setChoice(g.id, { stage: v as StatusCode })}>
                  {(["RECIBIDO_EN_ORIGEN", "EN_CENTRAL", "EN_TRANSITO", "EN_REPARTO"] as StatusCode[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                </Select>
                {choice(g.id).stage !== "EN_REPARTO" && (
                  <Select label="Centro logístico" value={choice(g.id).centerId} onChange={(v) => setChoice(g.id, { centerId: v })}>
                    <option value="">Selecciona un centro</option>{centers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
                  </Select>
                )}
              </div>
              <div className="form-actions"><Button disabled={choice(g.id).stage !== "EN_REPARTO" && !choice(g.id).centerId} onClick={() => void apply(g.id)}>Aplicar a todo el grupo</Button></div>
            </Card>
          ))}
        </div>
      ) : <Card><EmptyState icon="group" title="No hay grupos activos" description="Crea un grupo con envíos que no estén terminados ni pertenezcan a otro grupo." action={<Button icon="plus" onClick={() => setModal(true)}>Crear grupo</Button>} /></Card>}
      {modal && (
        <Modal title="Crear grupo" icon="group" onClose={() => setModal(false)} footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button><Button disabled={!name.trim() || !selected.length} onClick={create}>Crear grupo ({selected.length})</Button></>}>
          <Input label="Nombre del grupo" value={name} onChange={setName} maxLength={100} />
          <fieldset className="selection-list">
            <legend className="field-label">Envíos elegibles</legend>
            {eligible.length === 0 && <p className="field-helper">No hay envíos elegibles: todos están terminados o ya pertenecen a un grupo activo.</p>}
            {eligible.map((s) => (
              <label key={s.trackingId}>
                <input type="checkbox" checked={selected.includes(s.trackingId)} onChange={(e) => setSelected((p) => e.target.checked ? [...p, s.trackingId] : p.filter((id) => id !== s.trackingId))} />
                <span><b className="mono">{s.trackingId}</b><small>{s.recipientName}</small></span>
                <StatusBadge status={s.status} />
              </label>
            ))}
          </fieldset>
        </Modal>
      )}
    </>
  );
}
