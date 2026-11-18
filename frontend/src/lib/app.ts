import type { RoleCode } from "./api";

export type Notify = (message: string, kind?: "success" | "error") => void;

/** Props comunes de las pantallas dentro de la aplicación. */
export type PageProps = {
  token: string;
  role: RoleCode;
  notify: Notify;
  go: (page: string) => void;
  openTracking: (trackingId: string) => void;
};

export function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function writeStorage(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* almacenamiento no disponible */ }
}
