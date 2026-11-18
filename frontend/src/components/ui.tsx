import { useEffect, useId, useRef, type ReactNode, type Ref } from "react";
import type { StatusCode } from "../lib/api";
import { FLOW, STATUS, type Tone } from "../lib/status";
import { Icon, type IconName } from "./icons";

export { Icon };
export type { IconName };

// ---------------------------------------------------------------- botones y formularios

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "whatsapp";
  icon?: IconName;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  busy?: boolean;
  size?: "md" | "sm" | "lg";
  ariaLabel?: string;
};

export function Button({ children, variant = "primary", icon, onClick, type = "button", disabled, busy, size = "md", ariaLabel }: ButtonProps) {
  return (
    <button type={type} className={`btn btn-${variant} btn-${size}`} onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined} aria-label={ariaLabel}>
      {busy ? <span className="btn-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      <span>{children}</span>
    </button>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helper?: string;
  maxLength?: number;
  /** HU-06: muestra "n / máximo" y avisa al acercarse al límite. */
  counter?: boolean;
  autoComplete?: string;
  required?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  inputMode?: "text" | "numeric" | "email" | "decimal";
};

export function Input({ label, value, onChange, type = "text", placeholder, disabled, error, helper, maxLength, counter, autoComplete, required, inputRef, inputMode }: FieldProps) {
  const id = useId();
  const describedBy = [error && `${id}-error`, helper && `${id}-helper`, counter && `${id}-count`].filter(Boolean).join(" ") || undefined;
  const over = maxLength !== undefined && value.length > maxLength;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>
      <input id={id} ref={inputRef} className={error || over ? "input input-error" : "input"} value={value} type={type} placeholder={placeholder} disabled={disabled}
        aria-invalid={error || over ? true : undefined} aria-describedby={describedBy} aria-required={required || undefined}
        autoComplete={autoComplete} inputMode={inputMode} onChange={(e) => onChange?.(e.target.value)} />
      <div className="field-foot">
        <div>
          {error && <span className="field-error" id={`${id}-error`}><Icon name="warning" size={15} />{error}</span>}
          {helper && <span className="field-helper" id={`${id}-helper`}>{helper}</span>}
        </div>
        {counter && maxLength !== undefined && (
          <span className={`field-count ${over ? "over" : value.length > maxLength * 0.9 ? "near" : ""}`} id={`${id}-count`} aria-live={value.length > maxLength * 0.9 ? "polite" : "off"}>
            {value.length} / {maxLength}<span className="sr-only"> caracteres</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function Select({ label, value, onChange, children, disabled, helper }: { label: string; value: string; onChange?: (value: string) => void; children: ReactNode; disabled?: boolean; helper?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <span className="select-wrap">
        <select id={id} className="input" value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)} aria-describedby={helper ? `${id}-helper` : undefined}>{children}</select>
        <Icon name="chevron" size={16} />
      </span>
      {helper && <span className="field-helper" id={`${id}-helper`}>{helper}</span>}
    </div>
  );
}

export function Textarea({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <textarea id={id} className="input textarea" value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      {maxLength && <span className="field-count">{value.length} / {maxLength}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- estructura

export function Card({ children, className = "", labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return <section className={`card ${className}`} aria-labelledby={labelledBy}>{children}</section>;
}

export function CardHeader({ title, subtitle, action, id }: { title: string; subtitle?: string; action?: ReactNode; id?: string }) {
  return (
    <div className="card-header">
      <div>
        <h2 className="card-title" id={id}>{title}</h2>
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Encabezado de pantalla: el único h1 de la página (HU-A-25). */
export function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title" id="page-title" tabIndex={-1}>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = "blue", icon }: { children: ReactNode; tone?: Tone; icon?: IconName }) {
  return <span className={`badge badge-${tone}`}>{icon && <Icon name={icon} size={14} />}{children}</span>;
}

/** HU-A-24: estado con ícono + texto + color; nunca solo color. */
export function StatusBadge({ status, large = false }: { status: StatusCode; large?: boolean }) {
  const meta = STATUS[status];
  if (!meta) return <Badge tone="gray">{status}</Badge>;
  return <span className={`badge badge-${meta.tone} status-badge ${large ? "badge-lg" : ""}`}><Icon name={meta.icon} size={large ? 18 : 14} />{meta.label}</span>;
}

export function Stat({ label, value, icon, hint, tone = "blue" }: { label: string; value: ReactNode; icon: IconName; hint?: string; tone?: Tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon tone-${tone}`}><Icon name={icon} size={22} /></div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {hint && <p className="stat-hint">{hint}</p>}
      </div>
    </div>
  );
}

export function Table({ caption, headers, children }: { caption: string; headers: string[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{headers.map((h, i) => <th key={i} scope="col">{h || <span className="sr-only">Acciones</span>}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ icon = "package", title, description, action }: { icon?: IconName; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={28} /></div>
      <p className="empty-title">{title}</p>
      <p className="empty-copy">{description}</p>
      {action}
    </div>
  );
}

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" aria-hidden="true" /><span>{label}</span></div>;
}

export function Alert({ tone = "info", title, children, icon }: { tone?: "info" | "warning" | "error" | "success"; title?: string; children?: ReactNode; icon?: IconName }) {
  const defaultIcon: Record<string, IconName> = { info: "info", warning: "warning", error: "warning", success: "check" };
  return (
    <div className={`alert alert-${tone}`} role={tone === "error" ? "alert" : undefined}>
      <Icon name={icon ?? defaultIcon[tone]} />
      <div>{title && <strong>{title}</strong>}{children && <div className="alert-body">{children}</div>}</div>
    </div>
  );
}

// ---------------------------------------------------------------- modal accesible

export function Modal({ title, children, onClose, footer, tone = "default", icon, closable = true }: {
  title: string; children: ReactNode; onClose: () => void; footer: ReactNode; tone?: "default" | "danger" | "warning"; icon?: IconName; closable?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  // onClose en un ref: el efecto (foco inicial y trampa de foco) corre una sola vez aunque el padre se re-renderice.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea") ?? []).filter((el) => !el.hasAttribute("disabled"));
    (node?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closable) closeRef.current();
      if (e.key === "Tab") {
        const items = focusables();
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [closable]);
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} ref={ref} tabIndex={-1}>
        <div className="modal-header">
          <div className={`modal-icon modal-icon-${tone}`}><Icon name={icon ?? (tone === "default" ? "info" : "warning")} /></div>
          <h2 className="modal-title" id={`${id}-title`}>{title}</h2>
          {closable && <button className="icon-button" onClick={onClose} aria-label="Cerrar ventana"><Icon name="close" /></button>}
        </div>
        <div className="modal-body" id={`${id}-body`}>{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- seguimiento

/**
 * Línea de etapas. Para un envío cancelado muestra hasta dónde llegó y termina en
 * "Cancelado" (HU-A-24). Cada paso dice en texto si está completado, actual o pendiente.
 */
export function Pipeline({ status, lastStageBeforeCancel }: { status: StatusCode; lastStageBeforeCancel?: StatusCode | null }) {
  const cancelled = status === "CANCELADO";
  const reached = cancelled ? lastStageBeforeCancel ?? null : status;
  const reachedIndex = reached ? FLOW.indexOf(reached) : -1;
  const steps: { code: StatusCode; state: "done" | "current" | "pending" | "cancelled" }[] = cancelled
    ? [...FLOW.slice(0, reachedIndex + 1).map((code) => ({ code, state: "done" as const })), { code: "CANCELADO" as StatusCode, state: "cancelled" as const }]
    : FLOW.map((code, i) => ({ code, state: i < reachedIndex ? "done" : i === reachedIndex ? (code === "ENTREGADO" ? "done" : "current") : "pending" }));
  const stateText = { done: "completada", current: "etapa actual", pending: "pendiente", cancelled: "envío cancelado" };
  return (
    <ol className={`pipeline ${cancelled ? "pipeline-cancelled" : ""}`} aria-label="Etapas del envío">
      {steps.map((step, i) => {
        const meta = STATUS[step.code];
        return (
          <li key={step.code} className={`pipe-step ${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
            {i < steps.length - 1 && <span className="pipe-line" aria-hidden="true" />}
            <span className="pipe-dot" aria-hidden="true"><Icon name={step.state === "done" ? "check" : meta.icon} size={18} /></span>
            <span className="pipe-label">{meta.label}<span className="pipe-state">{stateText[step.state]}</span></span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- gráficos simples (con valores en texto)

export function BarList({ items, label }: { items: { label: ReactNode; value: number; tone?: Tone; hint?: string }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="bar-list" aria-label={label}>
      {items.map((item, i) => (
        <li key={i}>
          <div className="bar-head"><span>{item.label}</span><b>{item.value}{item.hint && <small> {item.hint}</small>}</b></div>
          <div className="bar-track" aria-hidden="true"><span className={`bar-fill fill-${item.tone ?? "blue"}`} style={{ width: `${(item.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function ColumnChart({ items, label }: { items: { label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="column-chart" aria-label={label}>
      {items.map((item) => (
        <li key={item.label}>
          <span className="column-value">{item.value}</span>
          <span className="column-bar" aria-hidden="true"><span style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }} /></span>
          <span className="column-label">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <div className="brand-mark"><Icon name="box" size={22} /></div>
      <div><b>TRACKLINE</b><span>Plataforma logística</span></div>
    </div>
  );
}
