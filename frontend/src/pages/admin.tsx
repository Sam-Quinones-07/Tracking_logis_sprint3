import { useEffect, useState } from "react";
import { api, errorMessage, type AccountSecurity, type RoleCode, type SecurityEvent, type SecurityEventType, type UserAccount } from "../lib/api";
import type { PageProps } from "../lib/app";
import { ROLE, SECURITY_EVENT, fmtShort, fmtTime } from "../lib/status";
import { Alert, Badge, BarList, Button, Card, CardHeader, EmptyState, Icon, Loading, Modal, PageTitle, Select, Stat, Table } from "../components/ui";

const ROLE_TONE: Record<RoleCode, "blue" | "purple" | "teal" | "gray"> = { CLIENTE: "blue", OPERADOR_LOGISTICO: "purple", SUPERVISOR_LOGISTICO: "teal", ADMINISTRADOR: "gray" };

function EventRow({ e }: { e: SecurityEvent }) {
  const meta = SECURITY_EVENT[e.type];
  return (
    <tr>
      <td><time dateTime={e.createdAt}>{fmtShort(e.createdAt)}</time></td>
      <td><Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge></td>
      <td>{e.targetEmail ?? "—"}</td>
      <td>{e.actorEmail ?? <span className="muted">Sistema</span>}</td>
      <td className="detail-cell">{e.detail}</td>
    </tr>
  );
}

export function AdminDashboard({ token, go }: PageProps) {
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [restricted, setRestricted] = useState<AccountSecurity[] | null>(null);
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  useEffect(() => {
    api<UserAccount[]>("/admin/users", token).then(setUsers).catch(() => setUsers([]));
    api<AccountSecurity[]>("/admin/users/security-status", token).then(setRestricted).catch(() => setRestricted([]));
    api<SecurityEvent[]>("/admin/security-events", token).then(setEvents).catch(() => setEvents([]));
  }, [token]);
  const byRole = (r: RoleCode) => users?.filter((u) => u.role === r).length ?? 0;
  const today = new Date().toDateString();
  const todayEvents = events?.filter((e) => new Date(e.createdAt).toDateString() === today).length ?? 0;
  return (
    <>
      <PageTitle eyebrow="Administración" title="Panel administrativo" description="Cuentas, roles y eventos de seguridad del sistema." action={<Button icon="shield" onClick={() => go("roles")}>Gestionar roles</Button>} />
      <div className="stats-grid four">
        <Stat label="Cuentas registradas" value={users?.length ?? "…"} icon="people" tone="blue" />
        <Stat label="Bloqueadas o en pausa" value={restricted?.length ?? "…"} icon="lock" tone="red" />
        <Stat label="Eventos de seguridad hoy" value={events ? todayEvents : "…"} icon="history" tone="amber" />
        <Stat label="Pendientes de verificar" value={users?.filter((u) => u.emailVerified === false).length ?? "…"} icon="mail" tone="purple" />
      </div>
      <div className="dashboard-grid">
        <Card>
          <CardHeader title="Actividad de seguridad reciente" action={<Button variant="ghost" size="sm" onClick={() => go("audit")}>Ver registro</Button>} />
          {!events ? <Loading /> : events.length ? (
            <ul className="event-feed">
              {events.slice(0, 6).map((e) => {
                const meta = SECURITY_EVENT[e.type];
                return (
                  <li key={e.id}>
                    <span className={`feed-icon tone-${meta.tone}`}><Icon name={meta.icon} size={16} /></span>
                    <div><b>{meta.label}</b><span className="muted">{e.targetEmail ?? e.actorEmail ?? ""} · {e.detail}</span></div>
                    <time dateTime={e.createdAt}>{fmtTime(e.createdAt)}</time>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState icon="shield" title="Sin eventos" description="Aquí aparecerán penalizaciones, bloqueos y cambios de rol." />}
        </Card>
        <Card>
          <CardHeader title="Cuentas por rol" />
          {users ? <BarList label="Cuentas por rol" items={(Object.keys(ROLE) as RoleCode[]).map((r) => ({ label: ROLE[r], value: byRole(r), tone: ROLE_TONE[r] }))} /> : <Loading />}
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- HU-17 / HU-S-21

export function Roles({ token, notify }: PageProps) {
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UserAccount | null>(null);
  const [role, setRole] = useState<RoleCode>("CLIENTE");
  const [busy, setBusy] = useState(false);
  const refresh = () => api<UserAccount[]>("/admin/users", token).then(setUsers).catch((e) => { setUsers([]); notify(errorMessage(e, "No se pudieron cargar las cuentas."), "error"); });
  useEffect(() => { void refresh(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = (users ?? []).filter((u) => `${u.fullName} ${u.email} ${u.identification}`.toLowerCase().includes(query.trim().toLowerCase()));
  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/admin/users/${selected.id}/role?role=${role}`, token, { method: "PUT" });
      notify(`${selected.fullName} ahora es ${ROLE[role]}. Sus sesiones abiertas se cerraron y el cambio quedó registrado.`);
      setSelected(null); void refresh();
    } catch (e) { notify(errorMessage(e, "No se pudo cambiar el rol."), "error"); }
    finally { setBusy(false); }
  };
  return (
    <>
      <PageTitle eyebrow="Control de acceso" title="Gestión de roles" description="Asigna Cliente, Operador Logístico o Supervisor Logístico. El rol Administrador no se asigna desde aquí." />
      <Card>
        <div className="toolbar">
          <div className="search-box"><label className="sr-only" htmlFor="role-q">Buscar cuentas</label><Icon name="search" /><input id="role-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, correo o identificación" /></div>
        </div>
        {!users ? <Loading /> : visible.length ? (
          <Table caption="Cuentas registradas" headers={["Cuenta", "Identificación", "Rol actual", "Estado", ""]}>
            {visible.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.fullName}</strong><small className="block">{u.email}</small></td>
                <td>{u.identification}</td>
                <td><Badge tone={ROLE_TONE[u.role]}>{ROLE[u.role]}</Badge></td>
                <td>{u.emailVerified === false ? <Badge tone="amber" icon="mail">Sin verificar</Badge> : <Badge tone="green" icon="check">Activa</Badge>}</td>
                <td>{u.role !== "ADMINISTRADOR" && <Button variant="secondary" size="sm" icon="edit" onClick={() => { setSelected(u); setRole(u.role); }} ariaLabel={`Cambiar rol de ${u.fullName}`}>Cambiar rol</Button>}</td>
              </tr>
            ))}
          </Table>
        ) : <EmptyState icon="people" title="Sin resultados" description="No hay cuentas que coincidan con la búsqueda." />}
      </Card>
      {selected && (
        <Modal title={`Cambiar rol de ${selected.fullName}`} icon="shield" onClose={() => setSelected(null)}
          footer={<><Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button><Button busy={busy} disabled={role === selected.role} onClick={save}>Guardar cambio</Button></>}>
          <p className="modal-copy">Rol actual: <b>{ROLE[selected.role]}</b></p>
          <Select label="Nuevo rol" value={role} onChange={(v) => setRole(v as RoleCode)}>
            <option value="CLIENTE">Cliente</option><option value="OPERADOR_LOGISTICO">Operador Logístico</option><option value="SUPERVISOR_LOGISTICO">Supervisor Logístico</option>
          </Select>
          <Alert tone="warning" title="Al guardar">Se cerrarán las sesiones abiertas de esta cuenta y se registrará quién hizo el cambio, el rol anterior y el nuevo.</Alert>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------- HU-S-19

export function Blocked({ token, notify }: PageProps) {
  const [rows, setRows] = useState<AccountSecurity[] | null>(null);
  const refresh = () => api<AccountSecurity[]>("/admin/users/security-status", token).then(setRows).catch((e) => { setRows([]); notify(errorMessage(e, "No se pudieron cargar las cuentas."), "error"); });
  useEffect(() => { void refresh(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const unlock = async (u: AccountSecurity) => {
    try { await api(`/admin/users/${u.id}/unlock`, token, { method: "PUT" }); notify(`${u.fullName} puede volver a iniciar sesión. El desbloqueo quedó registrado.`); void refresh(); }
    catch (e) { notify(errorMessage(e, "No se pudo desbloquear."), "error"); }
  };
  return (
    <>
      <PageTitle eyebrow="Protección contra fuerza bruta" title="Cuentas bloqueadas" description="Cuentas en pausa temporal o bloqueadas por intentos fallidos de inicio de sesión." action={<Button variant="secondary" icon="refresh" onClick={() => void refresh()}>Actualizar</Button>} />
      <ol className="penalty-flow" aria-label="Escalera de penalizaciones">
        <li><b>5 intentos fallidos</b><span>Pausa de 1 minuto</span></li>
        <li aria-hidden="true" className="arrow"><Icon name="arrow" /></li>
        <li><b>2 intentos más</b><span>Pausa de 2 minutos</span></li>
        <li aria-hidden="true" className="arrow"><Icon name="arrow" /></li>
        <li className="danger"><b>2 intentos más</b><span>Bloqueo hasta que Administración desbloquee</span></li>
      </ol>
      <Card>
        {!rows ? <Loading /> : rows.length ? (
          <Table caption="Cuentas restringidas" headers={["Cuenta", "Estado", ""]}>
            {rows.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.fullName}</strong><small className="block">{u.email}</small></td>
                <td>{u.accountLocked ? <Badge tone="red" icon="lock">Bloqueada</Badge> : <Badge tone="amber" icon="clock">En pausa hasta {u.penaltyUntil ? fmtTime(u.penaltyUntil) : "—"}</Badge>}</td>
                <td><Button size="sm" icon="unlock" onClick={() => void unlock(u)} ariaLabel={`Desbloquear a ${u.fullName}`}>Desbloquear</Button></td>
              </tr>
            ))}
          </Table>
        ) : <EmptyState icon="unlock" title="No hay cuentas restringidas" description="Las pausas temporales también aparecen aquí mientras están activas." />}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- registro de seguridad (HU-S-19, S-20, S-21, S-23)

export function SecurityLog({ token }: PageProps) {
  const [type, setType] = useState<"" | SecurityEventType>("");
  const [rows, setRows] = useState<SecurityEvent[] | null>(null);
  const [error, setError] = useState("");
  const load = () => { setRows(null); setError(""); api<SecurityEvent[]>(`/admin/security-events${type ? `?type=${type}` : ""}`, token).then(setRows).catch((e) => { setRows([]); setError(errorMessage(e, "No se pudo cargar el registro.")); }); };
  useEffect(load, [type, token]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <PageTitle eyebrow="Auditoría" title="Registro de seguridad" description="Penalizaciones, bloqueos, desbloqueos, consultas denegadas, cambios de rol y verificaciones de correo (últimos 300)." action={<Button variant="secondary" icon="refresh" onClick={load}>Actualizar</Button>} />
      <Card>
        <div className="toolbar">
          <div className="toolbar-select">
            <Select label="Tipo de evento" value={type} onChange={(v) => setType(v as typeof type)}>
              <option value="">Todos</option>
              {(Object.keys(SECURITY_EVENT) as SecurityEventType[]).map((t) => <option key={t} value={t}>{SECURITY_EVENT[t].label}</option>)}
            </Select>
          </div>
          {rows && <p className="muted" aria-live="polite">{rows.length} eventos</p>}
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {!rows ? <Loading /> : rows.length ? (
          <Table caption="Eventos de seguridad" headers={["Fecha y hora", "Evento", "Cuenta afectada", "Realizado por", "Detalle"]}>
            {rows.map((e) => <EventRow key={e.id} e={e} />)}
          </Table>
        ) : <EmptyState icon="history" title="Sin eventos" description="No hay eventos de este tipo registrados." />}
      </Card>
    </>
  );
}
