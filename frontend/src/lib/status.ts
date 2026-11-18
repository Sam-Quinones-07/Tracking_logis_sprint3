import type { CategoryCode, RoleCode, SecurityEventType, StatusCode } from "./api";
import type { IconName } from "../components/icons";

export type Tone = "blue" | "purple" | "amber" | "teal" | "green" | "red" | "gray";

/**
 * HU-A-24: cada estado tiene texto, ícono y color. El color nunca es la única pista:
 * el ícono y el nombre permiten distinguirlos también en escala de grises.
 */
export const STATUS: Record<StatusCode, { label: string; icon: IconName; tone: Tone; description: string }> = {
  RECIBIDO_EN_ORIGEN: { label: "Recibido en origen", icon: "inbox", tone: "blue", description: "El paquete fue recibido en el centro de origen." },
  EN_CENTRAL: { label: "En central", icon: "warehouse", tone: "purple", description: "El paquete está en el centro de distribución central." },
  EN_TRANSITO: { label: "En tránsito", icon: "truck", tone: "amber", description: "El paquete viaja hacia la ciudad de destino." },
  EN_REPARTO: { label: "En reparto", icon: "pin", tone: "teal", description: "El paquete salió a la dirección de entrega." },
  ENTREGADO: { label: "Entregado", icon: "check", tone: "green", description: "El paquete fue entregado al destinatario." },
  CANCELADO: { label: "Cancelado", icon: "ban", tone: "red", description: "El envío fue cancelado y no continuará su recorrido." },
};

export const FLOW: StatusCode[] = ["RECIBIDO_EN_ORIGEN", "EN_CENTRAL", "EN_TRANSITO", "EN_REPARTO", "ENTREGADO"];

export function statusLabel(code: string): string {
  return STATUS[code as StatusCode]?.label ?? code;
}

/** Misma regla que ShipmentStatus.expectedAfter en el servidor. */
export function nextStageAfter(lastStage: StatusCode | null): StatusCode | null {
  if (lastStage === null) return "RECIBIDO_EN_ORIGEN";
  const map: Partial<Record<StatusCode, StatusCode>> = { RECIBIDO_EN_ORIGEN: "EN_CENTRAL", EN_CENTRAL: "EN_TRANSITO", EN_TRANSITO: "EN_REPARTO", EN_REPARTO: "ENTREGADO" };
  return map[lastStage] ?? null;
}

/** Etapas en las que el servidor permite cancelar. */
export const CANCELLABLE: StatusCode[] = ["RECIBIDO_EN_ORIGEN", "EN_CENTRAL"];
export const TERMINAL: StatusCode[] = ["ENTREGADO", "CANCELADO"];

export const CATEGORY: Record<CategoryCode, string> = { PEQUENO: "Pequeño", MEDIANO: "Mediano", GRANDE: "Grande", EXTRAGRANDE: "Extragrande" };

export const ROLE: Record<RoleCode, string> = {
  CLIENTE: "Cliente",
  OPERADOR_LOGISTICO: "Operador Logístico",
  SUPERVISOR_LOGISTICO: "Supervisor Logístico",
  ADMINISTRADOR: "Administrador",
};

export const SECURITY_EVENT: Record<SecurityEventType, { label: string; icon: IconName; tone: Tone }> = {
  PENALIZACION: { label: "Penalización", icon: "clock", tone: "amber" },
  BLOQUEO: { label: "Bloqueo", icon: "lock", tone: "red" },
  DESBLOQUEO: { label: "Desbloqueo", icon: "unlock", tone: "green" },
  CONSULTA_DENEGADA: { label: "Consulta denegada", icon: "eyeOff", tone: "red" },
  ROL_CAMBIADO: { label: "Cambio de rol", icon: "shield", tone: "blue" },
  ROL_RECHAZADO: { label: "Cambio de rol rechazado", icon: "warning", tone: "red" },
  CORREO_VERIFICADO: { label: "Correo verificado", icon: "mail", tone: "green" },
};

const dateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
const shortFmt = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });

export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));
export const fmtShort = (iso: string) => shortFmt.format(new Date(iso));
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;

/** 49.5 → "2 d 1 h"; 5.2 → "5 h 12 min". */
export function fmtHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / 1440);
  const h = Math.floor((totalMinutes % 1440) / 60);
  const m = totalMinutes % 60;
  if (days > 0) return `${days} d ${h} h`;
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}
