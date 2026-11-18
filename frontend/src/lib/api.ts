// Cliente HTTP de la API. Toda decisión de acceso la toma el servidor; aquí solo se
// interpretan sus respuestas para mostrarlas al usuario.

export const API = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

/** Evento global: el servidor rechazó la sesión (401). `detail` trae el motivo. */
export const SESSION_EXPIRED_EVENT = "trackline-session-expired";

export type SessionEndDetail = { code: string; message: string };

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;
  body: Record<string, unknown>;
  constructor(status: number, message: string, body: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = typeof body.code === "string" ? body.code : undefined;
    this.fields = body.fields && typeof body.fields === "object" ? (body.fields as Record<string, string>) : undefined;
    this.body = body;
  }
}

/** Última respuesta correcta del servidor con sesión: el servidor cuenta la inactividad desde ahí. */
export const serverContact = { last: Date.now() };

export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor. Verifica que el backend esté en ejecución.", {});
  }
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  // Con token, un 401 significa que el servidor ya no acepta la sesión (inactividad, cierre o cambio de rol).
  if (token && response.status === 401) {
    const detail: SessionEndDetail = {
      code: typeof body.code === "string" ? body.code : "INVALIDA",
      message: typeof body.error === "string" ? body.error : "Tu sesión terminó. Inicia sesión de nuevo.",
    };
    window.dispatchEvent(new CustomEvent<SessionEndDetail>(SESSION_EXPIRED_EVENT, { detail }));
    throw new ApiError(401, detail.message, body);
  }
  if (!response.ok) {
    const message = (typeof body.error === "string" && body.error) || (typeof body.message === "string" && body.message) || "No fue posible completar la operación.";
    throw new ApiError(response.status, message, body);
  }
  if (token) serverContact.last = Date.now();
  return (response.status === 204 ? undefined : body) as T;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// ---------------------------------------------------------------- tipos de la API

export type RoleCode = "CLIENTE" | "OPERADOR_LOGISTICO" | "SUPERVISOR_LOGISTICO" | "ADMINISTRADOR";
export type StatusCode = "RECIBIDO_EN_ORIGEN" | "EN_CENTRAL" | "EN_TRANSITO" | "EN_REPARTO" | "ENTREGADO" | "CANCELADO";
export type CategoryCode = "PEQUENO" | "MEDIANO" | "GRANDE" | "EXTRAGRANDE";

export type LoginResponse = { token: string; email: string; fullName: string; role: RoleCode; sessionTimeoutSeconds?: number };
export type Shipment = {
  trackingId: string;
  senderCompanyName?: string;
  recipientName: string;
  recipientIdentification?: string;
  recipientAddress: string;
  weightCategory: CategoryCode;
  status: StatusCode;
  createdAt: string;
  message?: string;
};
export type ShipmentEvent = { id: number; stage: StatusCode; location: string; eventDateTime: string; groupEvent?: boolean; note?: string };
export type Group = { id: number; name: string; active: boolean; createdAt: string; shipments: { trackingId: string; recipientName: string; status: StatusCode }[] };
export type Center = { id: number; name: string; city: string };
export type UserAccount = { id: number; email: string; fullName: string; identification: string; address: string; cityCountry: string; role: RoleCode; createdAt: string; emailVerified?: boolean };
export type SecurityEventType = "PENALIZACION" | "BLOQUEO" | "DESBLOQUEO" | "CONSULTA_DENEGADA" | "ROL_CAMBIADO" | "ROL_RECHAZADO" | "CORREO_VERIFICADO";
export type SecurityEvent = { id: number; type: SecurityEventType; actorEmail: string | null; targetEmail: string | null; detail: string; createdAt: string };
export type AccountSecurity = { id: number; email: string; fullName: string; accountLocked: boolean; penaltyUntil: string | null };

export type TransitReport = {
  definition: string;
  count: number;
  averageHours: number | null;
  minHours: number | null;
  maxHours: number | null;
  stageAverages: { from: StatusCode; to: StatusCode; averageHours: number; samples: number }[];
  items: { trackingId: string; recipientName: string; weightCategory: CategoryCode; receivedAt: string; deliveredAt: string; hours: number }[];
};
export type DelayReport = {
  rule: string;
  limitHours: Record<CategoryCode, number>;
  activeEvaluated: number;
  items: { trackingId: string; recipientName: string; weightCategory: CategoryCode; status: StatusCode; receivedAt: string; elapsedHours: number; limitHours: number; overHours: number }[];
};
export type VolumeSummary = { total: number; active: number; byStatus: Record<StatusCode, number>; byCategory: Record<CategoryCode, number>; last7Days: { date: string; count: number }[] };
export type Contact = { whatsappAvailable: boolean; whatsappNumber: string; supportPhone: string; hours: string };
