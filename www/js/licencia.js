// Capa de licencia para Android (equivalente a license.js de Electron,
// pero usando Web Crypto + plugins de Capacitor, sin Node).
// - ID de equipo (HWID) a partir del ID de dispositivo de Android
// - Firma HMAC-SHA256 (mismo SECRET que el Apps Script)
// - Activación / demo 72 h / verificación en línea cada 5 días
// - Red por CapacitorHttp (petición nativa: sin CORS, sigue redirecciones)
(function () {
  const cfg = window.AFGF_CONFIG;
  const FIVE_DAYS = 5 * 24 * 3600;
  const GRACE = 2 * 24 * 3600;

  const Cap = window.Capacitor || {};
  const P = Cap.Plugins || {};
  const isNative = !!(Cap.isNativePlatform && Cap.isNativePlatform());

  function nowSec() { return Math.floor(Date.now() / 1000); }

  // ---- Utilerías cripto (Web Crypto) ----
  async function sha256hex(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function sign(message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(cfg.sharedSecret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function canonical(email, type, issued, expiry, hwid) {
    return `${email}|${type}|${issued}|${expiry}|${hwid}`;
  }

  // ---- ID de equipo (estable en Android) ----
  let _hwid = null;
  async function hardwareId() {
    if (_hwid) return _hwid;
    let raw;
    try {
      if (P.Device && P.Device.getId) {
        const d = await P.Device.getId();
        raw = d.identifier || d.uuid || "";
      }
    } catch (e) { raw = ""; }
    if (!raw) {
      // Fallback (navegador/dev): id aleatorio persistente
      raw = localStorage.getItem("afgf_devid");
      if (!raw) { raw = "dev-" + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem("afgf_devid", raw); }
    }
    _hwid = (await sha256hex("afgf|" + raw)).slice(0, 32);
    return _hwid;
  }

  // ---- Almacenamiento local (firmado) ----
  async function storeGet(k) {
    if (P.Preferences && P.Preferences.get) { const r = await P.Preferences.get({ key: k }); return r.value; }
    return localStorage.getItem(k);
  }
  async function storeSet(k, v) {
    if (P.Preferences && P.Preferences.set) { await P.Preferences.set({ key: k, value: v }); return; }
    localStorage.setItem(k, v);
  }
  async function storeRemove(k) {
    if (P.Preferences && P.Preferences.remove) { await P.Preferences.remove({ key: k }); return; }
    localStorage.removeItem(k);
  }

  async function save(l, lastCheck) {
    const hwid = await hardwareId();
    const o = {
      license: { email: l.email, type: l.type, issued: l.issued, expiry: l.expiry, hwid: hwid },
      sig: await sign(canonical(l.email, l.type, l.issued, l.expiry, hwid)),
      last_check: lastCheck || nowSec(),
    };
    await storeSet("afgf_license", JSON.stringify(o));
  }
  async function load() {
    try {
      const v = await storeGet("afgf_license");
      if (!v) return null;
      const o = JSON.parse(v);
      const l = o.license;
      const expect = await sign(canonical(l.email, l.type, l.issued, l.expiry, l.hwid));
      if (expect !== o.sig) return null;
      const hwid = await hardwareId();
      if (l.hwid !== hwid) return null;
      return Object.assign({}, l, { lastCheck: o.last_check || 0 });
    } catch (e) { return null; }
  }
  async function deactivate() { await storeRemove("afgf_license"); }

  function valid(l) { return l && l.type !== "none" && nowSec() < l.expiry; }
  function needsCheck(l) { return nowSec() - (l.lastCheck || 0) > FIVE_DAYS; }
  function withinGrace(l) { return nowSec() - (l.lastCheck || 0) <= FIVE_DAYS + GRACE; }

  // ---- Red (CapacitorHttp: nativo, sin CORS, sigue redirecciones) ----
  async function postForm(params) {
    const body = new URLSearchParams(params).toString();
    if (isNative && P.CapacitorHttp && P.CapacitorHttp.post) {
      const res = await P.CapacitorHttp.post({
        url: cfg.licenseEndpoint,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: body,
      });
      let d = res.data;
      if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { throw new Error("Respuesta no válida del servidor."); } }
      return d;
    }
    // Fallback navegador (dev): fetch normal (puede toparse con CORS)
    const r = await fetch(cfg.licenseEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return await r.json();
  }

  // ---- Operaciones ----
  async function activate(email, key) {
    email = (email || "").trim(); key = (key || "").trim();
    if (!email || !key) return { ok: false, error: "Escribe tu correo y la clave." };
    const hwid = await hardwareId();
    let r;
    try { r = await postForm({ action: "activate", email, key, hwid, ver: cfg.appVersion }); }
    catch (e) { return { ok: false, error: String(e.message || e) }; }
    if (!r.ok) return { ok: false, error: r.error || "Licencia rechazada." };
    const l = r.license;
    const expect = await sign(canonical(l.email, l.type, l.issued, l.expiry, hwid));
    if (expect !== r.sig) return { ok: false, error: "Firma de licencia no válida." };
    await save(l, nowSec());
    return { ok: true, type: l.type };
  }
  async function requestDemo() {
    const hwid = await hardwareId();
    let r;
    try { r = await postForm({ action: "demo", hwid, ver: cfg.appVersion }); }
    catch (e) { return { ok: false, error: String(e.message || e) }; }
    if (!r.ok) return { ok: false, error: r.error || "No se pudo activar la demo." };
    const l = r.license;
    const expect = await sign(canonical(l.email, l.type, l.issued, l.expiry, hwid));
    if (expect !== r.sig) return { ok: false, error: "Firma de demo no válida." };
    await save(l, nowSec());
    return { ok: true, type: l.type };
  }
  async function verifyOnline(email) {
    const hwid = await hardwareId();
    const r = await postForm({ action: "verify", email, hwid, ver: cfg.appVersion });
    if (!r.ok || !r.valid) throw new Error(r.error || "Licencia no válida o revocada.");
    return true;
  }
  async function info() {
    const l = await load();
    if (!l) return { activated: false };
    return {
      activated: true, email: l.email, type: l.type, expiry: l.expiry, hwid: l.hwid,
      daysLeft: Math.max(0, Math.ceil((l.expiry - nowSec()) / 86400)),
    };
  }

  window.AFGF_LIC = {
    hardwareId, load, save, deactivate, valid, needsCheck, withinGrace,
    activate, requestDemo, verifyOnline, info, nowSec,
  };
})();
