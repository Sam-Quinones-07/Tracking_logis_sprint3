import { useEffect, useState } from "react";
import { api, errorMessage, type Contact, type Shipment } from "../lib/api";
import type { PageProps } from "../lib/app";
import { TERMINAL, fmtShort } from "../lib/status";
import { Alert, Button, Card, CardHeader, EmptyState, Icon, Loading, PageTitle, Stat, StatusBadge } from "../components/ui";

export function ClientDashboard({ token, go, openTracking }: PageProps & { fullName: string }) {
  const [rows, setRows] = useState<Shipment[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Shipment[]>("/tracking/mine", token).then(setRows).catch((e) => setError(errorMessage(e, "No se pudieron cargar tus envíos."))); }, [token]);

  const active = rows?.filter((s) => !TERMINAL.includes(s.status)) ?? [];
  const delivered = rows?.filter((s) => s.status === "ENTREGADO").length ?? 0;
  const inDelivery = rows?.filter((s) => s.status === "EN_REPARTO") ?? [];

  return (
    <>
      <PageTitle eyebrow="Inicio" title="Tus envíos de un vistazo" description="Revisa qué paquetes vienen en camino y consulta su recorrido."
        action={<Button icon="search" onClick={() => go("tracking")}>Consultar un envío</Button>} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="stats-grid three">
        <Stat label="En camino" value={rows ? active.length : "…"} icon="truck" tone="amber" hint="Sin entregar ni cancelar" />
        <Stat label="En reparto" hint="Saliendo hacia tu dirección" value={rows ? inDelivery.length : "…"} icon="pin" tone="teal" />
        <Stat label="Entregados" value={rows ? delivered : "…"} icon="check" tone="green" />
      </div>
      <div className="dashboard-grid">
        <Card>
          <CardHeader title="Envíos en curso" subtitle="Los más recientes primero" action={<Button variant="ghost" size="sm" onClick={() => go("shipments")}>Ver todos</Button>} />
          {!rows ? <Loading /> : active.length ? (
            <ul className="shipment-list">
              {active.slice(0, 5).map((s) => (
                <li key={s.trackingId}>
                  <div>
                    <b className="mono">{s.trackingId}</b>
                    <span className="muted">{s.senderCompanyName ? `De ${s.senderCompanyName} · ` : ""}Registrado {fmtShort(s.createdAt)}</span>
                  </div>
                  <StatusBadge status={s.status} />
                  <Button variant="secondary" size="sm" onClick={() => openTracking(s.trackingId)} ariaLabel={`Ver seguimiento de ${s.trackingId}`}>Ver recorrido</Button>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="package" title="No tienes envíos en camino" description="Cuando registren un envío a tu nombre aparecerá aquí." />}
        </Card>
        <Card className="help-card">
          <div className="wa-icon"><Icon name="whatsapp" size={30} /></div>
          <h2 className="card-title">¿Necesitas ayuda con un envío?</h2>
          <p className="muted">Escríbenos por WhatsApp y un operador te atenderá. Es opcional: puedes seguir usando la plataforma normalmente.</p>
          <Button variant="whatsapp" icon="whatsapp" onClick={() => go("whatsapp")}>Contactar por WhatsApp</Button>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- HU-18

export function Whatsapp({ token }: PageProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState("");
  const [trackingId, setTrackingId] = useState("");
  useEffect(() => { api<Contact>("/contact", token).then(setContact).catch((e) => setError(errorMessage(e, "No se pudo cargar el canal de contacto."))); }, [token]);

  const message = `Hola, necesito ayuda con mi envío${trackingId.trim() ? ` ${trackingId.trim().toUpperCase()}` : ""}.`;
  const link = contact?.whatsappAvailable ? `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(message)}` : "";

  return (
    <>
      <PageTitle eyebrow="Atención al cliente" title="Contactar por WhatsApp" description="Habla con un operador sobre tu envío. El contacto es opcional." />
      {error && <Alert tone="error">{error}</Alert>}
      {!contact && !error && <Card><Loading /></Card>}
      {contact && (
        <Card className="whatsapp-card">
          <div className="wa-icon large"><Icon name="whatsapp" size={40} /></div>
          <div className="wa-content">
            <h2 className="wa-title">Escríbenos por WhatsApp</h2>
            <p className="muted">Se abrirá WhatsApp (aplicación o web) en una pestaña nueva con un mensaje listo para enviar. La conversación continúa en WhatsApp.</p>
            {contact.whatsappAvailable ? (
              <>
                <div className="wa-form">
                  <label className="field-label" htmlFor="wa-trk">Identificador del envío (opcional)</label>
                  <input id="wa-trk" className="input" value={trackingId} onChange={(e) => setTrackingId(e.target.value)} placeholder="TRK-…" />
                  <p className="field-helper">Mensaje: “{message}”</p>
                </div>
                <a className="btn btn-whatsapp btn-lg" href={link} target="_blank" rel="noopener noreferrer">
                  <Icon name="whatsapp" /><span>Abrir WhatsApp</span><span className="sr-only"> (se abre en una pestaña nueva)</span>
                </a>
              </>
            ) : <Alert tone="warning" title="Canal no configurado">La empresa aún no ha definido el número de WhatsApp. Mientras tanto puedes seguir consultando tus envíos.</Alert>}
            <dl className="contact-facts">
              {contact.hours && <div><dt><Icon name="clock" size={16} /> Horario</dt><dd>{contact.hours}</dd></div>}
              {contact.supportPhone && <div><dt><Icon name="phone" size={16} /> Teléfono de soporte</dt><dd>{contact.supportPhone}</dd></div>}
            </dl>
          </div>
        </Card>
      )}
    </>
  );
}
