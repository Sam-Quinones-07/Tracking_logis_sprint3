import { useCallback, useEffect, useRef, useState } from "react";
import { api, serverContact, SESSION_EXPIRED_EVENT, type LoginResponse, type RoleCode, type SessionEndDetail } from "./lib/api";
import { readStorage, writeStorage, type Notify, type PageProps } from "./lib/app";
import { ROLE } from "./lib/status";
import { Brand, Button, Icon, Modal, type IconName } from "./components/ui";
import Auth from "./pages/Auth";
import FontSizeControl from "./components/FontSizeControl";
import { Profile, Shipments, Tracking } from "./pages/common";
import { ClientDashboard, Whatsapp } from "./pages/client";
import { EventRegistration, Groups, NewShipment, OperatorDashboard } from "./pages/operator";
import { Delays, SupervisorDashboard, SupervisorUsers, TransitTimes, Volume } from "./pages/supervisor";
import { AdminDashboard, Blocked, Roles, SecurityLog } from "./pages/admin";

const SESSION_KEY = "trackline-session";
const DEFAULT_TIMEOUT = 300;
const WARNING_SECONDS = 60;
const HEARTBEAT_EVERY_MS = 60_000;

type Session = { user: LoginResponse; token: string; timeout: number };
type MenuItem = { label: string; icon: IconName; page: string };

const MENUS: Record<RoleCode, MenuItem[]> = {
  CLIENTE: [
    { label: "Inicio", icon: "dashboard", page: "dashboard" },
    { label: "Mis envíos", icon: "package", page: "shipments" },
    { label: "Consultar seguimiento", icon: "search", page: "tracking" },
    { label: "Mi perfil", icon: "user", page: "profile" },
    { label: "Contactar por WhatsApp", icon: "whatsapp", page: "whatsapp" },
  ],
  OPERADOR_LOGISTICO: [
    { label: "Resumen operativo", icon: "dashboard", page: "dashboard" },
    { label: "Registrar envío", icon: "plus", page: "new" },
    { label: "Envíos", icon: "package", page: "shipments" },
    { label: "Registrar evento", icon: "truck", page: "event" },
    { label: "Grupos de paquetes", icon: "group", page: "groups" },
    { label: "Consultar seguimiento", icon: "search", page: "tracking" },
    { label: "Mi perfil", icon: "user", page: "profile" },
  ],
  SUPERVISOR_LOGISTICO: [
    { label: "Panel de supervisión", icon: "dashboard", page: "dashboard" },
    { label: "Tiempos de tránsito", icon: "clock", page: "transit" },
    { label: "Retrasos", icon: "warning", page: "delays" },
    { label: "Volumen de envíos", icon: "chart", page: "volume" },
    { label: "Envíos por usuario", icon: "people", page: "users" },
    { label: "Consultar seguimiento", icon: "search", page: "tracking" },
    { label: "Mi perfil", icon: "user", page: "profile" },
  ],
  ADMINISTRADOR: [
    { label: "Panel administrativo", icon: "dashboard", page: "dashboard" },
    { label: "Gestión de roles", icon: "shield", page: "roles" },
    { label: "Cuentas bloqueadas", icon: "lock", page: "blocked" },
    { label: "Registro de seguridad", icon: "history", page: "audit" },
    { label: "Mi perfil", icon: "user", page: "profile" },
  ],
};

function renderPage(page: string, props: PageProps, extra: { trackingId: string; fullName: string }) {
  const { role } = props;
  switch (page) {
    case "dashboard":
      if (role === "CLIENTE") return <ClientDashboard {...props} fullName={extra.fullName} />;
      if (role === "OPERADOR_LOGISTICO") return <OperatorDashboard {...props} />;
      if (role === "SUPERVISOR_LOGISTICO") return <SupervisorDashboard {...props} />;
      return <AdminDashboard {...props} />;
    case "shipments": return <Shipments {...props} />;
    case "tracking": return <Tracking {...props} initialTrackingId={extra.trackingId} />;
    case "profile": return <Profile {...props} />;
    case "whatsapp": return <Whatsapp {...props} />;
    case "new": return <NewShipment {...props} />;
    case "event": return <EventRegistration {...props} />;
    case "groups": return <Groups {...props} />;
    case "transit": return <TransitTimes {...props} />;
    case "delays": return <Delays {...props} />;
    case "volume": return <Volume {...props} />;
    case "users": return <SupervisorUsers {...props} />;
    case "roles": return <Roles {...props} />;
    case "blocked": return <Blocked {...props} />;
    case "audit": return <SecurityLog {...props} />;
    default: return null;
  }
}

function Shell({ session, onLogout, warning, onStayConnected }: { session: Session; onLogout: () => void; warning: number | null; onStayConnected: () => void }) {
  const role = session.user.role;
  const menu = MENUS[role] ?? MENUS.CLIENTE;
  const [page, setPage] = useState("dashboard");
  const [trackingId, setTrackingId] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const firstRender = useRef(true);

  const notify: Notify = useCallback((message, kind = "success") => {
    setToast({ message, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), kind === "error" ? 7000 : 4500);
  }, []);
  const go = (next: string) => { if (next === "tracking") setTrackingId(""); setPage(next); setMenuOpen(false); };
  const openTracking = (id: string) => { setTrackingId(id); setPage("tracking"); };

  const title = menu.find((m) => m.page === page)?.label ?? "Trackline";
  // HU-A-25: título del documento por pantalla y foco en el encabezado al cambiar de pantalla.
  useEffect(() => {
    document.title = `${title} · Trackline`;
    if (firstRender.current) { firstRender.current = false; return; }
    window.scrollTo(0, 0);
    requestAnimationFrame(() => document.getElementById("page-title")?.focus());
  }, [page, title]);

  const initials = session.user.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const minutes = Math.round(session.timeout / 60);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <aside className={`sidebar ${menuOpen ? "open" : ""}`} aria-label="Menú principal">
        <Brand />
        <nav>
          <ul>
            {menu.map((item) => (
              <li key={item.page}>
                <button className={page === item.page ? "nav-item active" : "nav-item"} aria-current={page === item.page ? "page" : undefined} onClick={() => go(item.page)}>
                  <Icon name={item.icon} /><span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-security"><Icon name="shield" /><div><b>Sesión protegida</b><span>Se cierra tras {minutes} min sin actividad</span></div></div>
        <button className="logout" onClick={onLogout}><Icon name="logout" /> Cerrar sesión</button>
      </aside>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="app-area">
        <header className="topbar">
          <button className="icon-button menu-toggle" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-label="Abrir menú"><Icon name="dashboard" /></button>
          <p className="breadcrumb">Trackline <span aria-hidden="true">/</span> {title}</p>
          <FontSizeControl />
          <div className="user-block">
            <div className="avatar" aria-hidden="true">{initials}</div>
            <div><b>{session.user.fullName}</b><span>{ROLE[role]}</span></div>
          </div>
        </header>
        <main className="content" id="contenido" tabIndex={-1}>
          {renderPage(page, { token: session.token, role, notify, go, openTracking }, { trackingId, fullName: session.user.fullName })}
        </main>
      </div>
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
            <span className="toast-icon"><Icon name={toast.kind === "error" ? "warning" : "check"} /></span>
            <div><b>{toast.kind === "error" ? "No se completó la operación" : "Listo"}</b><small>{toast.message}</small></div>
            <button className="icon-button" onClick={() => setToast(null)} aria-label="Cerrar aviso"><Icon name="close" size={16} /></button>
          </div>
        )}
      </div>
      {warning !== null && (
        <Modal tone="warning" icon="clock" title="Tu sesión está por cerrarse" onClose={onStayConnected}
          footer={<><Button variant="ghost" onClick={onLogout}>Cerrar sesión</Button><Button onClick={onStayConnected}>Seguir conectado</Button></>}>
          <p className="modal-copy">Por seguridad, la sesión se cierra después de {minutes} minutos sin actividad.</p>
          <p className="countdown" aria-live="polite">Se cerrará en <b>{warning}</b> {warning === 1 ? "segundo" : "segundos"}.</p>
        </Modal>
      )}
    </div>
  );
}

function loadSession(): Session | null {
  try { const raw = readStorage(SESSION_KEY); return raw ? (JSON.parse(raw) as Session) : null; } catch { return null; }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());
  const heartbeatInFlight = useRef(false);

  const endSession = useCallback((message: string | null) => {
    writeStorage(SESSION_KEY, null);
    setSession(null);
    setWarning(null);
    setNotice(message);
  }, []);

  const logout = useCallback(() => {
    const current = loadSession();
    if (current) void api("/auth/logout", undefined, { method: "POST", headers: { Authorization: `Bearer ${current.token}` } }).catch(() => {});
    endSession(null);
  }, [endSession]);

  const acceptLogin = (user: LoginResponse) => {
    const next: Session = { user, token: user.token, timeout: user.sessionTimeoutSeconds || DEFAULT_TIMEOUT };
    writeStorage(SESSION_KEY, JSON.stringify(next));
    serverContact.last = Date.now();
    lastActivity.current = Date.now();
    setNotice(null);
    setSession(next);
  };

  const heartbeat = useCallback(() => {
    const current = loadSession();
    if (!current || heartbeatInFlight.current) return;
    heartbeatInFlight.current = true;
    api("/session/heartbeat", current.token, { method: "POST" }).catch(() => {}).finally(() => { heartbeatInFlight.current = false; });
  }, []);

  // HU-S-22: el servidor rechazó la sesión (inactividad, cierre, cambio de rol): ventana con el motivo.
  useEffect(() => {
    const onExpired = (e: Event) => endSession((e as CustomEvent<SessionEndDetail>).detail?.message ?? "Tu sesión terminó.");
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [endSession]);

  // HU-S-22: la interacción del usuario mantiene viva la sesión del servidor (latido como máximo
  // cada minuto). Sin interacción, avisa un minuto antes y cierra al cumplirse el tiempo.
  useEffect(() => {
    if (!session) return;
    const timeoutMs = session.timeout * 1000;
    const touch = () => { lastActivity.current = Date.now(); };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
    const timer = window.setInterval(() => {
      const now = Date.now();
      const idle = now - serverContact.last;
      const pendingActivity = lastActivity.current > serverContact.last;
      if (pendingActivity && (now - serverContact.last >= HEARTBEAT_EVERY_MS || idle >= timeoutMs - (WARNING_SECONDS + 10) * 1000)) { heartbeat(); }
      if (idle >= timeoutMs) {
        if (!pendingActivity) endSession(`Tu sesión se cerró por inactividad: pasaron ${session.timeout / 60} minutos sin actividad. Inicia sesión de nuevo.`);
      } else if (!pendingActivity && idle >= timeoutMs - WARNING_SECONDS * 1000) {
        setWarning(Math.ceil((timeoutMs - idle) / 1000));
      } else {
        setWarning(null);
      }
    }, 1000);
    return () => { events.forEach((ev) => window.removeEventListener(ev, touch)); window.clearInterval(timer); };
  }, [session, heartbeat, endSession]);

  // Al abrir la aplicación con una sesión guardada se confirma con el servidor que sigue vigente.
  useEffect(() => { if (session) { serverContact.last = Date.now(); heartbeat(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <Auth onLogin={acceptLogin} sessionNotice={notice} onDismissNotice={() => setNotice(null)} />;
  return <Shell session={session} onLogout={logout} warning={warning} onStayConnected={() => { lastActivity.current = Date.now(); heartbeat(); setWarning(null); }} />;
}
