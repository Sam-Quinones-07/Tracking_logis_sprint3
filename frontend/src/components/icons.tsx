import type { ReactNode } from "react";

export type IconName =
  | "arrow" | "ban" | "box" | "chart" | "check" | "chevron" | "clock" | "close" | "dashboard" | "edit" | "eye" | "eyeOff"
  | "group" | "history" | "inbox" | "info" | "lock" | "logout" | "mail" | "package" | "people" | "phone" | "pin" | "plus"
  | "refresh" | "search" | "shield" | "truck" | "unlock" | "user" | "warehouse" | "warning" | "whatsapp";

const paths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
  box: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
  chart: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  edit: <><path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z" /><path d="m14 7 3 3" /></>,
  eye: <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.4M6.6 6.6C3.8 8.3 2 12 2 12s4 6 10 6a9.6 9.6 0 0 0 5.4-1.6" /></>,
  group: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20c0-4 2-7 6-7s6 3 6 7M15 14c3 0 5 2 5 5" /></>,
  history: <><path d="M4 7v5h5" /><path d="M5 12a8 8 0 1 0 2-6" /><path d="M12 7v5l3 2" /></>,
  inbox: <><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5.5 5h13L21 13v6H3v-6l2.5-8Z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  logout: <path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  package: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M9 5v5" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2-7 6-7s6 3 6 7" /><circle cx="17" cy="9" r="2" /><path d="M16 14c3 0 5 2 5 5" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  pin: <><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 20v-4h-4" /></>,
  search: <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>,
  shield: <><path d="M12 3 4 6v5c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  unlock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-5 3-8 8-8s8 3 8 8" /></>,
  warehouse: <><path d="M3 21V9l9-5 9 5v12" /><path d="M7 21v-8h10v8M7 17h10" /></>,
  warning: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
  whatsapp: <><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z" /><path d="M9 8.5c.5 3 2 4.5 5 5" /></>,
};

/**
 * Por defecto los íconos son decorativos (aria-hidden). Si transmiten información que no está
 * en el texto cercano, se pasa `label` y el lector de pantalla lo anuncia (HU-A-25).
 */
export function Icon({ name, size = 20, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label} focusable="false">
      {paths[name]}
    </svg>
  );
}
