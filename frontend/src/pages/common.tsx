import { useEffect, useRef, useState } from "react";
import { api, ApiError, errorMessage, type Shipment, type ShipmentEvent, type StatusCode, type UserAccount } from "../lib/api";
import type { PageProps } from "../lib/app";
import { CANCELLABLE, CATEGORY, ROLE, STATUS, TERMINAL, fmtDate, fmtShort, fmtTime, statusLabel } from "../lib/status";
import { Alert, Button, Card, CardHeader, EmptyState, Icon, Input, Loading, Modal, PageTitle, Pipeline, Select, StatusBadge, Table, Textarea } from "../components/ui";

// ---------------------------------------------------------------- HU-10, HU-11, HU-A-24, HU-A-25

export function Tracking({ token, role, initialTrackingId = "" }: PageProps & { initialTrackingId?: string }) {
  const [code, setCode] = useState(initialTrackingId);
  const [state, setState] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<ShipmentEvent[]>([]);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const search = async (raw = code) => {
    const trackingId = raw.trim().toUpperCase();
    if (!trackingId) { setError("Escribe un identificador de seguimiento."); setState("error"); inputRef.current?.focus(); return; }
    setCode(trackingId); setState("loading"); setError(""); setAnnouncement("Consultando envío…");
    try {
      const enc = encodeURIComponent(trackingId);
      const [s, h] = await Promise.all([api<Shipment>(`/tracking/${enc}`, token), api<ShipmentEvent[]>(`/tracking/${enc}/events`, token)]);
      setShipment(s); setEvents(h); setState("found");
      const last = h[h.length - 1];
      setAnnouncement(`Envío ${s.trackingId}. Estado actual: ${statusLabel(s.status)}.` + (last ? ` Último movimiento el ${fmtDate(last.eventDateTime)} a las ${fmtTime(last.eventDateTime)} en ${last.location}.` : " Sin movimientos registrados.") + ` Historial con ${h.length} ${h.length === 1 ? "evento" : "eventos"}.`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      setShipment(null); setEvents([]); setState("error");
      const message = errorMessage(e, "No encontramos el envío.");
      setError(message); setAnnouncement(`Error: ${message}`);
      inputRef.current?.focus(); // HU-A-25: el foco queda en el campo para corregir.
    }
  };

  useEffect(() => { if (state === "found") resultRef.current?.focus(); }, [state, shipment]);
  useEffect(() => { if (initialTrackingId) void search(initialTrackingId); }, [initialTrackingId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (role === "ADMINISTRADOR") {
    return <><PageTitle title="Consulta de seguimiento" /><Card><EmptyState icon="lock" title="Acceso no permitido" description="El rol Administrador no consulta el estado ni el historial de los envíos." /></Card></>;
  }

  const lastBeforeCancel = shipment?.status === "CANCELADO" ? [...events].reverse().find((e) => e.stage !== "CANCELADO")?.stage ?? null : null;
  const cancelEvent = events.find((e) => e.stage === "CANCELADO");

  return (
    <>
      <PageTitle eyebrow="Seguimiento" title="Consulta de seguimiento" description={role === "CLIENTE" ? "Consulta el estado y el recorrido de un envío dirigido a ti." : "Consulta el estado y el historial de cualquier envío."} />
      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
      <Card className="tracking-search">
        <form role="search" aria-label="Buscar envío" onSubmit={(e) => { e.preventDefault(); void search(); }}>
          <div className="big-search">
            <Input label="Identificador de seguimiento" value={code} onChange={(v) => { setCode(v); if (state === "error") setState("idle"); }} placeholder="Ej. TRK-1A2B3C4D5E"
              inputRef={inputRef} error={state === "error" ? error : undefined} helper="Lo encuentras en el comprobante del envío. Empieza por TRK-." autoComplete="off" />
            <Button type="submit" icon="search" size="lg" busy={state === "loading"}>Consultar</Button>
          </div>
        </form>
      </Card>

      {state === "loading" && <Card><Loading label="Consultando envío…" /></Card>}

      {state === "found" && shipment && (
        <>
          <Card className="tracking-result" labelledBy="result-title">
            <div className="tracking-top">
              <div>
                <h2 className="result-title" id="result-title" ref={resultRef} tabIndex={-1}>Envío {shipment.trackingId}</h2>
                <p className="muted">Para {shipment.recipientName} · {shipment.recipientAddress}</p>
              </div>
              <div className="tracking-status">
                <span className="muted">Estado actual</span>
                <StatusBadge status={shipment.status} large />
              </div>
            </div>
            <p className="status-description"><Icon name={STATUS[shipment.status].icon} /> {STATUS[shipment.status].description}</p>
            <Pipeline status={shipment.status} lastStageBeforeCancel={lastBeforeCancel} />
            {cancelEvent?.note && <div className="tracking-note"><Alert tone="error" icon="ban" title="Motivo de la cancelación">{cancelEvent.note}</Alert></div>}
            <dl className="facts">
              <div><dt>Categoría</dt><dd>{CATEGORY[shipment.weightCategory]}</dd></div>
              <div><dt>Registrado</dt><dd>{fmtShort(shipment.createdAt)}</dd></div>
              <div><dt>Movimientos</dt><dd>{events.length}</dd></div>
            </dl>
          </Card>
          <Card labelledBy="history-title">
            <CardHeader id="history-title" title="Historial de movimientos" subtitle="Del más antiguo al más reciente" />
            {events.length ? (
              <ol className="timeline">
                {events.map((ev, i) => {
                  const meta = STATUS[ev.stage];
                  const current = i === events.length - 1;
                  return (
                    <li key={ev.id} className={`timeline-item ${current ? "current" : ""} tl-${meta.tone}`}>
                      <span className="timeline-marker" aria-hidden="true"><Icon name={meta.icon} size={16} /></span>
                      <div className="timeline-body">
                        <p className="timeline-title">
                          <span className="sr-only">Paso {i + 1}: </span>{meta.label}
                          {current && <span className="tag"><span className="sr-only">, </span>Más reciente</span>}
                          {ev.groupEvent && <span className="tag tag-gray"><span className="sr-only">, </span>Registrado en grupo</span>}
                        </p>
                        <p className="timeline-meta">
                          <time dateTime={ev.eventDateTime}>{fmtDate(ev.eventDateTime)}, {fmtTime(ev.eventDateTime)}</time>
                          <span aria-hidden="true"> · </span><span className="sr-only">. Lugar: </span>
                          <Icon name="pin" size={14} /> {ev.location}
                        </p>
                        {ev.note && <p className="timeline-note">Nota: {ev.note}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : <EmptyState icon="history" title="Aún no hay movimientos" description="El envío está registrado, pero todavía no tiene eventos logísticos." />}
          </Card>
        </>
      )}
      {state === "idle" && !shipment && (
        <div className="hint-row">
          {(["RECIBIDO_EN_ORIGEN", "EN_CENTRAL", "EN_TRANSITO", "EN_REPARTO", "ENTREGADO", "CANCELADO"] as StatusCode[]).map((s) => <StatusBadge key={s} status={s} />)}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- HU-12 (cliente) y listado del operador (HU-08)

export function Shipments({ token, role, notify, go, openTracking }: PageProps) {
  const [rows, setRows] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | StatusCode>("ALL");
  const [cancel, setCancel] = useState<Shipment | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const isClient = role === "CLIENTE";

  const refresh = () => {
    setLoading(true);
    api<Shipment[]>(isClient ? "/tracking/mine" : "/operador/shipments", token).then(setRows).catch((e) => notify(errorMessage(e, "No se pudieron cargar los envíos."), "error")).finally(() => setLoading(false));
  };
  useEffect(refresh, [token, role]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = rows.filter((s) => {
    const matchesText = `${s.trackingId} ${s.recipientName} ${s.recipientAddress} ${s.senderCompanyName ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = filter === "ALL" || (filter === "ACTIVE" ? !TERMINAL.includes(s.status) : s.status === filter);
    return matchesText && matchesStatus;
  });

  const confirmCancel = async () => {
    if (!cancel) return;
    setBusy(true);
    try {
      await api(`/operador/shipments/${cancel.trackingId}/cancel`, token, { method: "POST", body: JSON.stringify({ reason }) });
      notify(`Envío ${cancel.trackingId} cancelado. El motivo quedó en el historial.`);
      setCancel(null); setReason(""); refresh();
    } catch (e) { notify(errorMessage(e, "No se pudo cancelar."), "error"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageTitle eyebrow={isClient ? "Asociados a tu identificación" : "Operación"} title={isClient ? "Mis envíos" : "Envíos registrados"}
        description={isClient ? "Envíos cuyo destinatario tiene tu número de identificación." : "Consulta, filtra y cancela envíos que aún estén en origen o en central."}
        action={!isClient ? <Button icon="plus" onClick={() => go("new")}>Registrar envío</Button> : undefined} />
      <Card>
        <div className="toolbar">
          <div className="search-box">
            <label className="sr-only" htmlFor="ship-filter">Buscar envíos</label>
            <Icon name="search" />
            <input id="ship-filter" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por TRK, destinatario o dirección" />
          </div>
          <div className="toolbar-select">
            <Select label="Estado" value={filter} onChange={(v) => setFilter(v as typeof filter)}>
              <option value="ALL">Todos</option>
              <option value="ACTIVE">En curso</option>
              {Object.entries(STATUS).map(([code, meta]) => <option key={code} value={code}>{meta.label}</option>)}
            </Select>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">{loading ? "" : `${visible.length} envíos en la lista.`}</p>
        {loading ? <Loading label="Cargando envíos…" /> : visible.length ? (
          <Table caption={isClient ? "Mis envíos" : "Envíos registrados"} headers={["Seguimiento", isClient ? "Remitente" : "Destinatario", "Categoría", "Estado", "Registrado", ""]}>
            {visible.map((s) => (
              <tr key={s.trackingId}>
                <td><strong className="mono">{s.trackingId}</strong></td>
                {isClient
                  ? <td>{s.senderCompanyName ?? "—"}</td>
                  : <td>{s.recipientName}<small className="block">{s.recipientAddress}</small></td>}
                <td>{CATEGORY[s.weightCategory]}</td>
                <td><StatusBadge status={s.status} /></td>
                <td>{fmtShort(s.createdAt)}</td>
                <td>
                  <div className="row-actions">
                    <Button variant="secondary" size="sm" icon="eye" onClick={() => openTracking(s.trackingId)} ariaLabel={`Ver seguimiento de ${s.trackingId}`}>Ver</Button>
                    {role === "OPERADOR_LOGISTICO" && CANCELLABLE.includes(s.status) && <Button variant="ghost" size="sm" icon="ban" onClick={() => setCancel(s)} ariaLabel={`Cancelar ${s.trackingId}`}>Cancelar</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : <EmptyState title={rows.length ? "Ningún envío coincide con el filtro" : "No hay envíos todavía"} description={rows.length ? "Prueba con otro texto o estado." : isClient ? "Cuando un operador registre un envío a tu nombre, aparecerá aquí." : "Registra el primer envío para empezar."} />}
      </Card>
      {cancel && (
        <Modal tone="danger" icon="ban" title={`Cancelar envío ${cancel.trackingId}`} onClose={() => setCancel(null)}
          footer={<><Button variant="ghost" onClick={() => setCancel(null)}>Volver</Button><Button variant="danger" busy={busy} disabled={!reason.trim()} onClick={confirmCancel}>Confirmar cancelación</Button></>}>
          <p className="modal-copy">Esta acción no se puede deshacer. El envío pasará a <b>Cancelado</b> y el motivo quedará visible en su historial.</p>
          <div className="cancel-summary"><StatusBadge status={cancel.status} /><span>{cancel.recipientName}</span></div>
          <Textarea label="Motivo de la cancelación" value={reason} onChange={setReason} maxLength={500} placeholder="Ej. El remitente solicitó anular el envío" />
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------- HU-03 / HU-06

const ADDRESS_MAX = 200;
const CITY_MAX = 100;

export function Profile({ token, notify }: PageProps) {
  const [profile, setProfile] = useState<UserAccount | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ address?: string; cityCountry?: string; general?: string }>({});

  useEffect(() => {
    api<UserAccount>("/profile", token).then((p) => { setProfile(p); setAddress(p.address); setCity(p.cityCountry); })
      .catch((e) => setErrors({ general: errorMessage(e, "No se pudo cargar tu perfil.") })).finally(() => setLoading(false));
  }, [token]);

  const local = {
    address: !address.trim() ? "La dirección es obligatoria." : address.length > ADDRESS_MAX ? `La dirección no puede superar ${ADDRESS_MAX} caracteres.` : undefined,
    cityCountry: !city.trim() ? "La ciudad y el país son obligatorios." : city.length > CITY_MAX ? `La ciudad y el país no pueden superar ${CITY_MAX} caracteres.` : undefined,
  };
  const changed = Boolean(profile && (address.trim() !== profile.address || city.trim() !== profile.cityCountry));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (local.address || local.cityCountry) { setErrors(local); return; }
    setSaving(true); setErrors({});
    try {
      const updated = await api<UserAccount>("/profile", token, { method: "PUT", body: JSON.stringify({ address: address.trim(), cityCountry: city.trim() }) });
      setProfile(updated); setAddress(updated.address); setCity(updated.cityCountry);
      notify("Tus datos se actualizaron correctamente.");
    } catch (err) {
      setErrors({ ...(err instanceof ApiError ? err.fields : {}), general: errorMessage(err, "No se pudieron guardar los cambios.") });
    } finally { setSaving(false); }
  };

  if (loading) return <><PageTitle title="Mi perfil" /><Card><Loading label="Cargando perfil…" /></Card></>;
  if (!profile) return <><PageTitle title="Mi perfil" /><Card><EmptyState icon="user" title="No pudimos cargar tu perfil" description={errors.general ?? "Vuelve a intentarlo."} /></Card></>;

  const initials = profile.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <>
      <PageTitle eyebrow="Cuenta" title="Mi perfil" description="Consulta tus datos y actualiza tu dirección y ciudad." />
      <div className="profile-layout">
        <Card className="profile-summary">
          <div className="profile-avatar" aria-hidden="true">{initials}</div>
          <p className="profile-name">{profile.fullName}</p>
          <p className="muted">{ROLE[profile.role]}</p>
          <p className="profile-verified"><Icon name="mail" size={16} /> Correo verificado</p>
          <p className="muted small">Cuenta creada el {fmtDate(profile.createdAt)}</p>
        </Card>
        <Card>
          <form onSubmit={save} noValidate>
            <CardHeader title="Datos de la cuenta" subtitle="El correo, la identificación y el nombre no se pueden modificar." />
            <div className="form-grid two">
              <Input label="Nombre completo" value={profile.fullName} disabled />
              <Input label="Correo electrónico" value={profile.email} disabled />
              <Input label="Identificación" value={profile.identification} disabled />
              <Input label="Rol" value={ROLE[profile.role]} disabled />
            </div>
            <div className="divider-line" />
            <h2 className="section-title">Datos editables</h2>
            <div className="form-grid">
              <Input label="Dirección" value={address} onChange={(v) => { setAddress(v); setErrors({}); }} maxLength={ADDRESS_MAX} counter required error={errors.address} autoComplete="street-address" />
              <Input label="Ciudad y país" value={city} onChange={(v) => { setCity(v); setErrors({}); }} maxLength={CITY_MAX} counter required error={errors.cityCountry} placeholder="Ej. Medellín, Colombia" />
            </div>
            {errors.general && <Alert tone="error">{errors.general}</Alert>}
            <div className="form-actions">
              <Button variant="ghost" disabled={!changed || saving} onClick={() => { setAddress(profile.address); setCity(profile.cityCountry); setErrors({}); }}>Descartar cambios</Button>
              <Button type="submit" busy={saving} disabled={!changed}>Guardar cambios</Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
