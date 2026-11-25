# ArtefGo Frames — App Android (Fase 1)

App de cámara + marco para eventos, construida con **Capacitor**. Fase 1:
activación por **clave de serie** (contra el mismo Apps Script que usas en
escritorio), **cámara**, colocación de **marco** y **guardar/compartir** la foto.

> Fase 2 (después de probar): planes de **suscripción por Google Play** (6/12
> meses) y envío por WiFi a la PC para impresión. La activación por serial se
> queda como canal de venta directa.

## Cómo se genera el APK (automático)
Cada push a `main` (o a ramas `feat/**`) dispara **GitHub Actions**, que:
1. Instala dependencias.
2. **Ofusca** `www/js` (SECRET y URL quedan ilegibles en el APK).
3. `npx cap sync android`.
4. Compila el **APK debug** con Gradle.
5. Lo sube como **artifact** descargable.

Para bajarlo: pestaña **Actions** → el último run → sección **Artifacts** →
`ArtefGo-Frames-debug-apk`. Descomprime y tienes `app-debug.apk`.
Instálalo en el teléfono activando "orígenes desconocidos".

## Estructura
- `www/` — la app (editable). **Edita aquí.**
  - `js/config.js` — SECRET y URL del Apps Script.
  - `js/licencia.js` — licencia Android (ID de equipo, HMAC Web Crypto, CapacitorHttp).
  - `js/app.js` — activación + editor + cámara.
  - `index.html` — pantallas (activación y editor).
- `android/` — proyecto nativo (generado por Capacitor).
- `obfuscate.js` — ofusca `www/js` antes de compilar (lo corre el workflow).
- `.github/workflows/android.yml` — build del APK.

## Desarrollo local (opcional)
```
npm install
npx cap sync android
# abrir android/ en Android Studio para correr en un dispositivo
```
Si corres `node obfuscate.js` a mano, recupera el fuente con `git checkout www/js`.

## Licencia / activación
Usa **claves nuevas** (no usadas) de tu hoja: al activar en Android, la clave
se amarra al **ID de dispositivo** de ese teléfono. Una clave ya pegada a una PC
no activa en Android (el ID se calcula distinto).
