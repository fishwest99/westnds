import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { CompanyHeader } from "./load-form-company";

// pdfmake's @types package only covers the browser API; use a require for server-side PdfPrinter
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require("pdfmake/js/Printer").default as new (
  fonts: import("pdfmake/interfaces").TFontDictionary,
  virtualfs?: unknown,
  urlResolver?: { resolve: (url: string, headers?: Record<string, string>) => string },
  localAccessPolicy?: (path: string) => boolean,
) => {
  createPdfKitDocument(docDefinition: TDocumentDefinitions, options?: Record<string, unknown>): NodeJS.EventEmitter & { end(): void };
};

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const urlResolver = { resolve: (url: string) => url };
const printer = new PdfPrinter(fonts, undefined, urlResolver);

/** Returns ☑ if selected, ☐ if not */
function chk(selected: string[], key: string): string {
  return selected.includes(key) ? "☑" : "☐";
}

/** Build an inline text array for a row of checkbox items */
function checkboxRow(items: string[], selected: string[]): Content {
  const parts: import("pdfmake/interfaces").ContentText[] = [];
  for (const item of items) {
    parts.push({ text: `${chk(selected, item)} ${item}   ` });
  }
  return { text: parts };
}

export async function generateCaseStudyFormPdf(form: Record<string, unknown>, company?: CompanyHeader): Promise<Buffer> {
  const f = (key: string): string => String(form[key] ?? "");
  const b = (key: string): boolean => Boolean(form[key]);

  const co: CompanyHeader = company ?? { name: "", address: "", phone: "", fax: "", ein: "" };
  const contactLine = [
    co.phone ? `Phone: ${co.phone}` : "",
    co.fax ? `Fax: ${co.fax}` : "",
    co.ein ? `EIN # ${co.ein}` : "",
  ].filter(Boolean).join("    ");

  const selectedProcedures: string[] = JSON.parse(String(form.selectedProcedures || "[]"));
  const electrodePickupSites: string[] = JSON.parse(String(form.electrodePickupSites || "[]"));
  const selectedEPNerves: string[] = JSON.parse(String(form.selectedEPNerves || "[]"));
  const selectedEMGMuscles: string[] = JSON.parse(String(form.selectedEMGMuscles || "[]"));

  const techSig = f("technicianSignature");
  const techSigContent: Content = techSig.startsWith("data:image")
    ? { image: techSig, width: 120, height: 40 }
    : { text: f("technicianName") || "___________________" };

  const docDef: TDocumentDefinitions = {
    defaultStyle: { font: "Helvetica", fontSize: 9 },
    pageMargins: [40, 50, 40, 50],
    content: [
      // ── Company Header ──────────────────────────────────────────────
      {
        text: co.name || " ",
        bold: true,
        fontSize: 13,
        alignment: "center",
      } as Content,
      {
        text: co.address || " ",
        alignment: "center",
        fontSize: 9,
      } as Content,
      {
        text: contactLine || " ",
        alignment: "center",
        fontSize: 9,
        marginBottom: 6,
      } as Content,

      // ── Title Block ─────────────────────────────────────────────────
      {
        text: "History of Electrodes and Muscles:",
        bold: true,
        alignment: "center",
        decoration: "underline",
        fontSize: 11,
        marginBottom: 2,
      } as Content,
      {
        text: "(Circle the completed procedure[s])",
        alignment: "center",
        fontSize: 9,
        marginBottom: 8,
      } as Content,

      // ── Patient / Tech Info ─────────────────────────────────────────
      {
        columns: [
          { text: [{ text: "Patient Name: ", bold: true }, f("patientName")], width: "*" },
          { text: [{ text: "Date: ", bold: true }, f("date")], width: 130 },
          { text: [{ text: "Technician: ", bold: true }, f("technicianName")], width: 150 },
        ],
        marginBottom: 6,
      } as Content,

      // ── Craniotomy Diagnosis ─────────────────────────────────────────
      {
        text: [{ text: "Craniotomy diagnosis: ", bold: true }, f("craniotomyDiagnosis")],
        marginBottom: 8,
      } as Content,

      // ── Procedure Grid ───────────────────────────────────────────────
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }],
        marginBottom: 4,
      } as Content,
      {
        text: "Procedures:",
        bold: true,
        decoration: "underline",
        marginBottom: 3,
      } as Content,

      // Row 1: ACDF through C8
      checkboxRow(["ACDF", "Posterior Cervical", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"], selectedProcedures),
      { text: "", marginBottom: 2 } as Content,

      // Row 2: Lumbar procedures
      checkboxRow(["Lumbar Laminectomy", "Microdiscectomy", "Fusion", "ALIF", "XLIF", "TLIF", "Hardware Removal"], selectedProcedures),
      { text: "", marginBottom: 2 } as Content,

      // Row 3: T1-T12
      checkboxRow(["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"], selectedProcedures),
      { text: "", marginBottom: 2 } as Content,

      // Row 4: L1-S1
      checkboxRow(["L1", "L2", "L3", "L4", "L5", "S1"], selectedProcedures),
      { text: "", marginBottom: 4 } as Content,

      // Cranial Nerve Procedures
      {
        text: "Cranial Nerve Procedures:",
        bold: true,
        marginBottom: 2,
      } as Content,
      checkboxRow(["Thyroidectomy", "Parathyroidectomy", "Tympanoplasty", "Parotidectomy"], selectedProcedures),
      { text: "", marginBottom: 2 } as Content,
      { text: [{ text: "Other Procedure: ", bold: true }, String(form.procedureOther || "")], marginBottom: 4 } as Content,

      // Electrode pickup sites
      {
        text: "Electrode pickup site:",
        bold: true,
        marginBottom: 2,
      } as Content,
      checkboxRow(["CPZ", "FPZ", "C1", "C2", "CP3", "CP4", "C5", "A1", "A2"], electrodePickupSites),
      { text: "", marginBottom: 2 } as Content,
      {
        text: [{ text: "Other: ", bold: true }, f("electrodeOther")],
        marginBottom: 8,
      } as Content,

      // ── Evoked Potential Nerves ──────────────────────────────────────
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }],
        marginBottom: 4,
      } as Content,
      {
        text: "Evoked Potential Nerves Used:",
        bold: true,
        decoration: "underline",
        marginBottom: 3,
      } as Content,

      // EP Row 1
      checkboxRow(["Median", "Ulnar", "Radial", "C5", "C6", "C7", "C8", "Erbs", "Posterior Tibial", "Peroneal"], selectedEPNerves),
      { text: "", marginBottom: 2 } as Content,

      // EP Row 2
      checkboxRow(["L2", "L3", "L4", "L5", "S1", "Saphenous", "Pop Fossa"], selectedEPNerves),
      { text: "", marginBottom: 8 } as Content,

      // ── EMG Muscles ──────────────────────────────────────────────────
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }],
        marginBottom: 4,
      } as Content,
      {
        text: "EMG Muscles Used:",
        bold: true,
        decoration: "underline",
        marginBottom: 3,
      } as Content,

      // EMG Row 1
      checkboxRow(["Trapezius", "Deltoids", "Biceps", "Triceps", "Abductor Pollicis", "Vast. Medialis", "EHL"], selectedEMGMuscles),
      { text: "", marginBottom: 2 } as Content,

      // EMG Row 2
      checkboxRow(["Anterior Tibialis", "Medial Gastrocs"], selectedEMGMuscles),
      { text: "", marginBottom: 2 } as Content,

      // EMG Row 3: Motors / Uppers / Lowers
      checkboxRow(["Upper MEPs", "Lower MEPs"], selectedEMGMuscles),
      { text: "", marginBottom: 2 } as Content,

      // ABR
      {
        text: [
          { text: "ABR:  " },
          { text: `${chk(selectedEMGMuscles, "ABR Right")} Right   ` },
          { text: `${chk(selectedEMGMuscles, "ABR Left")} Left   ` },
        ],
        marginBottom: 2,
      } as Content,

      // VER
      {
        text: [
          { text: "VER:  " },
          { text: `${chk(selectedEMGMuscles, "VER Right")} Right   ` },
          { text: `${chk(selectedEMGMuscles, "VER Left")} Left   ` },
        ],
        marginBottom: 8,
      } as Content,

      // ── Problems / Signal Loss ───────────────────────────────────────
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }],
        marginBottom: 4,
      } as Content,
      {
        text: [{ text: "Note any problems or signal loss: ", bold: true }],
        marginBottom: 2,
      } as Content,
      {
        text: f("problemsOrSignalLoss") || " ",
        marginBottom: 2,
      } as Content,
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }],
        marginBottom: 8,
      } as Content,

      // ── Diabetic & Patient History ───────────────────────────────────
      {
        text: [
          { text: "Diabetic: ", bold: true },
          b("diabetic") ? "☑" : "☐",
          { text: "    Patient history: ", bold: true },
          f("patientHistory"),
        ],
        marginBottom: 8,
      } as Content,

      // ── Technician Signature ─────────────────────────────────────────
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }],
        marginBottom: 4,
      } as Content,
      {
        columns: [
          {
            width: "*",
            text: [{ text: "Name of technician: ", bold: true }, f("technicianName")],
          },
          {
            width: "*",
            stack: [
              { text: [{ text: "Signature: ", bold: true }] },
              techSigContent,
            ],
          },
        ],
        marginBottom: 12,
      } as Content,

      // ── Footer ───────────────────────────────────────────────────────
      {
        text: "*This form must be filled out completely*",
        bold: true,
        alignment: "center",
        italics: true,
        fontSize: 9,
      } as Content,
    ],

    styles: {
      sectionHeader: { fontSize: 9, bold: true, fillColor: "#dce6f1" },
    },
  };

  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(docDef);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
