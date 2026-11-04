// pdf.js necesita su worker como archivo estático: se copia a public/ para que la
// versión del worker siempre coincida con la de pdfjs-dist instalada.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const origen = "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs";

if (existsSync(origen)) {
    mkdirSync("public", { recursive: true });
    copyFileSync(origen, "public/pdf.worker.min.mjs");
} else {
    console.warn("[pdf.js] no se encontró", origen, "- el visor de PDF no va a funcionar.");
}
