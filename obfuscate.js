// obfuscate.js — ofusca el JS de www/js ANTES de compilar el APK.
//
// Sobrescribe www/js/*.js con la versión ofuscada. En CI (GitHub Actions)
// corre sobre una copia desechable, así que no afecta tu repo.
// Si lo corres en tu máquina y quieres recuperar el original:
//   git checkout www/js
//
//   node obfuscate.js
//
const fs = require("fs");
const path = require("path");
const JO = require("javascript-obfuscator");

const DIR = path.join(__dirname, "www", "js");

const STRONG = {
  compact: true,
  controlFlowFlattening: true, controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true, deadCodeInjectionThreshold: 0.4,
  numbersToExpressions: true, simplify: true,
  stringArray: true, stringArrayThreshold: 1, stringArrayEncoding: ["base64"],
  stringArrayCallsTransform: true, stringArrayWrappersType: "function",
  splitStrings: true, splitStringsChunkLength: 6,
  selfDefending: true, transformObjectKeys: false, renameGlobals: false,
  identifierNamesGenerator: "hexadecimal",
};
const LIGHT = {
  compact: true, controlFlowFlattening: false, deadCodeInjection: false,
  numbersToExpressions: false, simplify: true,
  stringArray: true, stringArrayThreshold: 0.8, stringArrayEncoding: ["base64"],
  splitStrings: false, selfDefending: false, transformObjectKeys: false,
  renameGlobals: false, identifierNamesGenerator: "hexadecimal",
};

const FILES = [
  ["config.js", STRONG],
  ["licencia.js", STRONG],
  ["app.js", LIGHT],
];

console.log("Ofuscando www/js ...");
for (const [name, opts] of FILES) {
  const p = path.join(DIR, name);
  const code = fs.readFileSync(p, "utf8");
  const out = JO.obfuscate(code, opts).getObfuscatedCode();
  fs.writeFileSync(p, out);
  console.log("  " + name);
}
console.log("Listo.");
