// ArtefGo Frames (Android) — arranque, activación y editor con cámara.
(function () {
  const Lic = window.AFGF_LIC;
  const cfg = window.AFGF_CONFIG;
  const Cap = window.Capacitor || {};
  const P = Cap.Plugins || {};
  const isNative = !!(Cap.isNativePlatform && Cap.isNativePlatform());
  const $ = (id) => document.getElementById(id);

  // Estado del editor
  const SIZES = { "4x6": [1200, 1800], "6x8": [1800, 2400] };
  let curSize = "4x6";
  let photoImg = null;   // Image de la foto
  let frameImg = null;   // Image del marco (PNG con transparencia)
  let isDemo = false;

  // ---------- Arranque ----------
  async function boot() {
    $("actIcon").src = "icon.png";
    $("edIcon").src = "icon.png";
    try {
      const lic = await Lic.load();
      if (!Lic.valid(lic)) { showActivation(); return; }
      if (Lic.needsCheck(lic)) {
        try {
          await Lic.verifyOnline(lic.email);
          await Lic.save(lic, Lic.nowSec());
        } catch (e) {
          if (!Lic.withinGrace(lic)) {
            showActivation("No se pudo verificar la licencia. Conéctate a internet para seguir usando la app.");
            return;
          }
        }
      }
      startEditor(lic.type === "demo");
    } catch (e) {
      showActivation("Error al leer la licencia: " + (e.message || e));
    }
  }

  // ---------- Activación ----------
  async function showActivation(message) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("on"));
    $("activation").classList.add("on");
    if (message) $("msg").textContent = message;
    try { $("hwid").textContent = await Lic.hardwareId(); } catch (e) { $("hwid").textContent = "—"; }
  }
  function busy(b) { $("btnActivate").disabled = b; $("btnDemo").disabled = b; }

  $("btnActivate").addEventListener("click", async () => {
    $("msg").textContent = "Activando…"; busy(true);
    const r = await Lic.activate($("email").value, $("key").value);
    busy(false);
    if (r.ok) startEditor(r.type === "demo");
    else $("msg").textContent = "No se pudo activar: " + r.error;
  });
  $("btnDemo").addEventListener("click", async () => {
    $("msg").textContent = "Solicitando demo…"; busy(true);
    const r = await Lic.requestDemo();
    busy(false);
    if (r.ok) startEditor(true);
    else $("msg").textContent = "No se pudo activar la demo: " + r.error;
  });

  // ---------- Editor ----------
  function startEditor(demo) {
    isDemo = !!demo;
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("on"));
    $("editor").classList.add("on");
    render();
  }

  function render() {
    const [w, h] = SIZES[curSize];
    const cv = $("preview");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Foto: cubrir todo el lienzo (cover)
    if (photoImg) drawCover(ctx, photoImg, 0, 0, w, h);
    else {
      ctx.fillStyle = "#eeeeee"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#9a9a9a"; ctx.textAlign = "center";
      ctx.font = Math.round(w * 0.045) + "px sans-serif";
      ctx.fillText("Toma una foto", w / 2, h / 2);
    }
    // Marco encima, escalado a todo el lienzo
    if (frameImg) ctx.drawImage(frameImg, 0, 0, w, h);

    // Marca de agua de demo
    if (isDemo) {
      ctx.save();
      ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 6);
      ctx.globalAlpha = 0.28; ctx.fillStyle = "#000";
      ctx.textAlign = "center"; ctx.font = "bold " + Math.round(w * 0.12) + "px sans-serif";
      ctx.fillText("DEMO", 0, 0);
      ctx.restore();
    }
  }

  function drawCover(ctx, img, dx, dy, dw, dh) {
    const ir = img.width / img.height, dr = dw / dh;
    let sw, sh, sx, sy;
    if (ir > dr) { sh = img.height; sw = sh * dr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / dr; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
  }

  // Tamaños
  document.querySelectorAll(".sizes button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".sizes button").forEach((x) => x.classList.remove("act"));
      b.classList.add("act");
      curSize = b.getAttribute("data-size");
      render();
    });
  });

  // Tomar foto (cámara nativa o file input)
  $("btnPhoto").addEventListener("click", async () => {
    try {
      if (isNative && P.Camera && P.Camera.getPhoto) {
        const ph = await P.Camera.getPhoto({
          quality: 92, allowEditing: false, resultType: "dataUrl", source: "CAMERA", saveToGallery: false,
        });
        photoImg = await loadImage(ph.dataUrl);
        render();
      } else {
        $("photoInput").click();
      }
    } catch (e) { /* cancelado por el usuario */ }
  });
  $("photoInput").addEventListener("change", (e) => readFileToImage(e, (im) => { photoImg = im; render(); }));

  // Cargar marco
  $("btnFrame").addEventListener("click", () => $("frameInput").click());
  $("frameInput").addEventListener("change", (e) => readFileToImage(e, (im) => { frameImg = im; render(); }));

  function readFileToImage(e, cb) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => { cb(await loadImage(rd.result)); };
    rd.readAsDataURL(f);
    e.target.value = "";
  }

  // Guardar / Compartir
  $("btnSave").addEventListener("click", async () => {
    const cv = $("preview");
    const dataUrl = cv.toDataURL("image/jpeg", 0.95);
    const name = "ArtefGo_" + new Date().toISOString().replace(/[:.]/g, "-") + ".jpg";
    if (isNative && P.Filesystem && P.Share) {
      try {
        const base64 = dataUrl.split(",")[1];
        const w = await P.Filesystem.writeFile({
          path: name, data: base64, directory: "CACHE",
        });
        await P.Share.share({ title: "ArtefGo Frames", text: "Foto", files: [w.uri] });
      } catch (e) { alert("No se pudo compartir: " + (e.message || e)); }
    } else {
      const a = document.createElement("a");
      a.href = dataUrl; a.download = name; a.click();
    }
  });

  // Licencia
  $("btnLic").addEventListener("click", async () => {
    $("licModal").classList.add("on");
    const el = $("licBox");
    try {
      const i = await Lic.info();
      if (!i.activated) { el.textContent = "No hay licencia activa."; return; }
      const vence = new Date(i.expiry * 1000).toLocaleDateString();
      const tipo = i.type === "demo" ? "Demo (72 h)" : "Licencia completa";
      el.innerHTML =
        "<b>Tipo:</b> " + tipo + "<br>" +
        "<b>Correo:</b> " + (i.email || "—") + "<br>" +
        "<b>Vence:</b> " + vence + " (" + i.daysLeft + " días)<br>" +
        "<b>ID de equipo:</b><br><span class='mono'>" + i.hwid + "</span>";
    } catch (e) { el.textContent = "No se pudo leer la licencia."; }
  });
  $("btnLicClose").addEventListener("click", () => $("licModal").classList.remove("on"));
  $("btnDeact").addEventListener("click", async () => {
    if (!confirm("¿Desactivar la licencia en este equipo? Tendrás que volver a activar.")) return;
    await Lic.deactivate();
    $("licModal").classList.remove("on");
    showActivation("Licencia desactivada. Vuelve a activar.");
  });

  // Inicia cuando el DOM está listo
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
