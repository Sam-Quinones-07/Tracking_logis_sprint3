import { useEffect, useRef, useState } from "react";
import { api, ApiError, errorMessage, type LoginResponse } from "../lib/api";
import { readStorage, writeStorage } from "../lib/app";
import { Alert, Brand, Button, Icon, Input, Modal } from "../components/ui";
import FontSizeControl from "../components/FontSizeControl";

const REMEMBERED_EMAIL_KEY = "trackline-remembered-email";
const ADDRESS_MAX = 200;
const CITY_MAX = 100;

type View = "login" | "register" | "registered" | "verify" | "resend";
type VerifyState = { status: "loading" | "ok" | "error"; message: string; email?: string };

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function Auth({ onLogin, sessionNotice, onDismissNotice }: { onLogin: (user: LoginResponse) => void; sessionNotice: string | null; onDismissNotice: () => void }) {
  const verifyToken = useRef(new URLSearchParams(window.location.search).get("verificar"));
  const [view, setView] = useState<View>(verifyToken.current ? "verify" : "login");
  const [email, setEmail] = useState(() => readStorage(REMEMBERED_EMAIL_KEY) || "");
  const [remember, setRemember] = useState(() => readStorage(REMEMBERED_EMAIL_KEY) !== null);
  const [password, setPassword] = useState("");
  const [form, setForm] = useState({ fullName: "", identification: "", email: "", password: "", address: "", cityCountry: "" });
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [verify, setVerify] = useState<VerifyState>({ status: "loading", message: "" });
  const [resendEmail, setResendEmail] = useState("");
  const [touched, setTouched] = useState(false);
  // HU-S-22: el motivo del cierre se presenta en una ventana emergente; al cerrarla queda como aviso.
  const [noticeModal, setNoticeModal] = useState(Boolean(sessionNotice));
  useEffect(() => { if (sessionNotice) setNoticeModal(true); }, [sessionNotice]);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = { login: "Iniciar sesión", register: "Crear cuenta", registered: "Confirma tu correo", verify: "Verificación de correo", resend: "Reenviar enlace" }[view] + " · Trackline";
    document.getElementById("auth-title")?.focus();
  }, [view]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  // HU-S-23: el enlace del correo abre la aplicación con ?verificar=CODIGO.
  useEffect(() => {
    const token = verifyToken.current;
    if (!token) return;
    verifyToken.current = null; // el enlace sirve una sola vez: no repetir la petición si el efecto se ejecuta de nuevo
    window.history.replaceState(null, "", window.location.pathname);
    api<{ message: string; email?: string }>("/auth/verify", undefined, { method: "POST", body: JSON.stringify({ token }) })
      .then((r) => { setVerify({ status: "ok", message: r.message, email: r.email }); if (r.email) setEmail(r.email); })
      .catch((e) => {
        const body = e instanceof ApiError ? e.body : {};
        const linkedEmail = typeof body.email === "string" ? body.email : undefined;
        if (linkedEmail) setResendEmail(linkedEmail);
        setVerify({ status: "error", message: errorMessage(e, "No fue posible verificar el enlace."), email: linkedEmail });
      });
  }, []);

  const change = (next: View) => { setView(next); setError(""); setErrorCode(undefined); setInfo(""); setTouched(false); onDismissNotice(); };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setErrorCode(undefined); setInfo(""); onDismissNotice();
    if (!emailOk(email)) { setError("Escribe un correo electrónico válido, por ejemplo nombre@dominio.com."); return; }
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    setBusy(true);
    try {
      const user = await api<LoginResponse>("/auth/login", undefined, { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
      writeStorage(REMEMBERED_EMAIL_KEY, remember ? email.trim() : null);
      onLogin(user);
    } catch (err) {
      setError(errorMessage(err, "No se pudo iniciar sesión."));
      setErrorCode(err instanceof ApiError ? err.code : undefined);
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") setResendEmail(email.trim());
    } finally { setBusy(false); }
  };

  const fieldErrors = {
    fullName: !form.fullName.trim() ? "Escribe tu nombre completo." : "",
    identification: !/^[0-9]{1,10}$/.test(form.identification) ? "Usa solo números, hasta 10 dígitos." : "",
    email: !emailOk(form.email) ? "Escribe un correo con formato nombre@dominio.com." : "",
    password: form.password.length < 8 ? "Usa al menos 8 caracteres." : "",
    address: !form.address.trim() ? "Escribe tu dirección." : form.address.length > ADDRESS_MAX ? `Máximo ${ADDRESS_MAX} caracteres.` : "",
    cityCountry: !form.cityCountry.trim() ? "Escribe tu ciudad y país." : form.cityCountry.length > CITY_MAX ? `Máximo ${CITY_MAX} caracteres.` : "",
  };
  const show = (key: keyof typeof fieldErrors) => (touched || form[key] ? fieldErrors[key] : "") || undefined;

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true); setError("");
    if (Object.values(fieldErrors).some(Boolean)) { setError("Revisa los campos marcados para continuar."); return; }
    setBusy(true);
    try {
      const result = await api<{ email: string; message: string; devVerificationLink?: string }>("/auth/register", undefined, { method: "POST", body: JSON.stringify(form) });
      setResendEmail(result.email); setEmail(result.email); setDevLink(result.devVerificationLink ?? null); setInfo(result.message);
      setForm({ fullName: "", identification: "", email: "", password: "", address: "", cityCountry: "" });
      setView("registered");
    } catch (err) { setError(errorMessage(err, "No se pudo crear la cuenta.")); }
    finally { setBusy(false); }
  };

  const submitResend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(""); setInfo("");
    if (!emailOk(resendEmail)) { setError("Escribe el correo con el que te registraste."); return; }
    setBusy(true);
    try {
      const r = await api<{ message: string; devVerificationLink?: string }>("/auth/resend-verification", undefined, { method: "POST", body: JSON.stringify({ email: resendEmail.trim() }) });
      setInfo(r.message); setDevLink(r.devVerificationLink ?? null);
    } catch (err) { setError(errorMessage(err, "No se pudo reenviar el enlace.")); }
    finally { setBusy(false); }
  };

  const devBox = devLink && (
    <div className="dev-box">
      <strong><Icon name="info" size={16} /> Modo desarrollo: no hay servidor de correo configurado</strong>
      <span>En producción este enlace llega al correo. Para la demostración puedes abrirlo aquí:</span>
      <a href={devLink}>Abrir enlace de verificación</a>
    </div>
  );

  const errorBox = error && (
    <div className="alert alert-error" role="alert" tabIndex={-1} ref={errorRef}>
      <Icon name="warning" />
      <div>
        <strong>{error}</strong>
        {errorCode === "EMAIL_NOT_VERIFIED" && <div className="alert-body"><button type="button" className="link-button" onClick={() => change("resend")}>Reenviar el enlace de verificación</button></div>}
      </div>
    </div>
  );

  return (
    <div className="auth-shell">
      <aside className="auth-brand" aria-label="Trackline">
        <Brand light />
        <div className="auth-message">
          <p className="auth-kicker">Seguimiento de envíos</p>
          <p className="auth-hero">Tu envío, siempre a la vista.</p>
          <p className="auth-subtitle">Una vez lo sigues aquí, ya no quieres adivinar dónde está.</p>
          <ul className="auth-features">
            <li><Icon name="shield" /> Acceso protegido por rol</li>
            <li><Icon name="history" /> Historial completo del recorrido</li>
            <li><Icon name="mail" /> Cuentas con correo verificado</li>
          </ul>
        </div>
        <div className="auth-stages" aria-hidden="true">
          {["inbox", "warehouse", "truck", "pin", "check"].map((n, i) => <span key={n} style={{ animationDelay: `${i * 0.15}s` }}><Icon name={n as "inbox"} size={22} /></span>)}
        </div>
      </aside>

      <main className="auth-main" id="contenido">
        <div className="auth-tools"><FontSizeControl /></div>
        <div className="auth-card">
          {sessionNotice && view === "login" && <Alert tone="warning" title="Tu sesión terminó" icon="clock">{sessionNotice}</Alert>}

          {view === "login" && (
            <form onSubmit={submitLogin} noValidate className="auth-form">
              <h1 className="auth-title" id="auth-title" tabIndex={-1}>Inicia sesión</h1>
              <p className="auth-copy">El sistema identifica tu rol a partir de tu cuenta.</p>
              <Input label="Correo electrónico" type="email" value={email} autoComplete="username" inputMode="email" required onChange={(v) => { setEmail(v); setError(""); }} />
              <Input label="Contraseña" type="password" value={password} autoComplete="current-password" required helper="Mínimo 8 caracteres" onChange={(v) => { setPassword(v); setError(""); }} />
              {errorBox}
              <label className="check-label"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Recordar mi correo en este equipo</label>
              <Button type="submit" size="lg" busy={busy} disabled={!email.trim() || !password}>Iniciar sesión</Button>
              <p className="auth-switch">¿No tienes cuenta? <button type="button" className="link-button" onClick={() => change("register")}>Crear una cuenta</button></p>            </form>
          )}

          {view === "register" && (
            <form onSubmit={submitRegister} noValidate className="auth-form">
              <h1 className="auth-title" id="auth-title" tabIndex={-1}>Crea tu cuenta</h1>
              <p className="auth-copy">Te enviaremos un enlace para confirmar tu correo antes de activar la cuenta.</p>
              <div className="form-grid two">
                <Input label="Nombre completo" value={form.fullName} required autoComplete="name" error={show("fullName")} onChange={(v) => setForm({ ...form, fullName: v })} />
                <Input label="Identificación" value={form.identification} required inputMode="numeric" error={show("identification")} helper="Solo números, máximo 10. No se puede cambiar después." onChange={(v) => setForm({ ...form, identification: v })} />
                <Input label="Correo electrónico" type="email" value={form.email} required autoComplete="email" error={show("email")} onChange={(v) => setForm({ ...form, email: v })} />
                <Input label="Contraseña" type="password" value={form.password} required autoComplete="new-password" error={show("password")} helper="Mínimo 8 caracteres" onChange={(v) => setForm({ ...form, password: v })} />
              </div>
              <Input label="Dirección" value={form.address} required maxLength={ADDRESS_MAX} counter autoComplete="street-address" error={show("address")} onChange={(v) => setForm({ ...form, address: v })} />
              <Input label="Ciudad y país" value={form.cityCountry} required maxLength={CITY_MAX} counter placeholder="Ej. Medellín, Colombia" error={show("cityCountry")} onChange={(v) => setForm({ ...form, cityCountry: v })} />
              {errorBox}
              <Button type="submit" size="lg" busy={busy}>Crear cuenta</Button>
              <p className="auth-switch">¿Ya tienes cuenta? <button type="button" className="link-button" onClick={() => change("login")}>Inicia sesión</button></p>
            </form>
          )}

          {view === "registered" && (
            <div className="auth-form" role="status">
              <div className="auth-illustration tone-blue"><Icon name="mail" size={34} /></div>
              <h1 className="auth-title" id="auth-title" tabIndex={-1}>Revisa tu correo</h1>
              <p className="auth-copy">{info}</p>
              <ul className="steps-list">
                <li><b>1.</b> Abre el correo de Trackline que enviamos a <b>{resendEmail}</b>.</li>
                <li><b>2.</b> Pulsa el enlace (sirve una vez y vence en 24 horas).</li>
                <li><b>3.</b> Inicia sesión con tu correo y contraseña.</li>
              </ul>
              {devBox}
              <Button variant="secondary" onClick={() => change("resend")} icon="refresh">No me llegó, reenviar enlace</Button>
              <Button variant="ghost" onClick={() => change("login")}>Ir a iniciar sesión</Button>
            </div>
          )}

          {view === "verify" && (
            <div className="auth-form" aria-live="polite">
              {verify.status === "loading" && <><div className="auth-illustration tone-blue"><span className="spinner" aria-hidden="true" /></div><h1 className="auth-title" id="auth-title" tabIndex={-1}>Verificando tu correo…</h1></>}
              {verify.status === "ok" && <>
                <div className="auth-illustration tone-green"><Icon name="check" size={34} /></div>
                <h1 className="auth-title" id="auth-title" tabIndex={-1}>¡Cuenta activada!</h1>
                <p className="auth-copy">{verify.message}</p>
                <Button size="lg" onClick={() => change("login")}>Iniciar sesión</Button>
              </>}
              {verify.status === "error" && <>
                <div className="auth-illustration tone-red"><Icon name="warning" size={34} /></div>
                <h1 className="auth-title" id="auth-title" tabIndex={-1}>No pudimos verificar el enlace</h1>
                <Alert tone="error">{verify.message}</Alert>
                <Button onClick={() => change("resend")} icon="refresh">Solicitar un enlace nuevo</Button>
                <Button variant="ghost" onClick={() => change("login")}>Ir a iniciar sesión</Button>
              </>}
            </div>
          )}

          {view === "resend" && (
            <form onSubmit={submitResend} noValidate className="auth-form">
              <h1 className="auth-title" id="auth-title" tabIndex={-1}>Reenviar enlace de verificación</h1>
              <p className="auth-copy">El enlace nuevo reemplaza a los anteriores. Puedes pedir hasta 3 por hora.</p>
              <Input label="Correo con el que te registraste" type="email" value={resendEmail} required onChange={setResendEmail} />
              {errorBox}
              {info && <Alert tone="success" title="Solicitud recibida">{info}</Alert>}
              {devBox}
              <Button type="submit" size="lg" busy={busy}>Enviar enlace nuevo</Button>
              <p className="auth-switch"><button type="button" className="link-button" onClick={() => change("login")}>Volver a iniciar sesión</button></p>
            </form>
          )}
        </div>
      </main>
      {sessionNotice && noticeModal && (
        <Modal tone="warning" icon="clock" title="Tu sesión terminó" onClose={() => setNoticeModal(false)}
          footer={<Button onClick={() => setNoticeModal(false)}>Entendido, iniciar sesión</Button>}>
          <p className="modal-copy">{sessionNotice}</p>
          <p className="modal-copy">Por seguridad, los datos de la sesión anterior ya no están disponibles.</p>
        </Modal>
      )}
    </div>
  );
}
