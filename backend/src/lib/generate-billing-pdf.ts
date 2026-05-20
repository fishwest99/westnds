import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import type { CompanyHeader } from "./load-form-company";

// pdfmake's @types package only covers the browser API; use a require for server-side PdfPrinter
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require("pdfmake/js/Printer").default as new (
  fonts: import("pdfmake/interfaces").TFontDictionary,
  virtualfs?: unknown,
  urlResolver?: { resolve: (url: string, headers?: Record<string, string>) => string; resolved: () => Promise<void> },
  localAccessPolicy?: (path: string) => boolean,
) => {
  createPdfKitDocument(docDefinition: TDocumentDefinitions, options?: Record<string, unknown>): Promise<NodeJS.EventEmitter & { end(): void }>;
};

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const urlResolver = { resolve: (url: string) => url, resolved: () => Promise.resolve() };
const printer = new PdfPrinter(fonts, undefined, urlResolver);

function field(label: string, value: string): Content {
  return { text: [{ text: `${label}: `, bold: true }, value] };
}

function cptRows(entries: [string, string][], f: (key: string) => string, yesNo = false): TableCell[][] {
  return entries.map(([label, key]) => {
    const raw = f(key);
    const display = yesNo ? (raw === "yes" ? "Yes" : "No") : raw;
    return [
      { text: label } as TableCell,
      { text: display, alignment: "center" as const } as TableCell,
    ];
  });
}

export async function generateBillingFormPdf(form: Record<string, unknown>, company?: CompanyHeader): Promise<Buffer> {
  const f = (key: string): string => String(form[key] ?? "");
  const b = (key: string): boolean => Boolean(form[key]);
  const co: CompanyHeader = company ?? { name: "", address: "", phone: "", fax: "", ein: "" };
  const contactLine = [
    co.phone ? `Phone: ${co.phone}` : "",
    co.fax ? `Fax: ${co.fax}` : "",
    co.ein ? `EIN # ${co.ein}` : "",
  ].filter(Boolean).join("    ");

  const evokedRows = cptRows([
    ["95930 — Visual EP", "cptVisual"],
    ["95938 — Auditory EP", "cptAuditory"],
    ["95938 — Upper Extremities SSEP", "cptUpperExtremities"],
    ["95938 — Lower Extremities SSEP", "cptLowerExtremities"],
    ["95939 — Upper Motor EP (TcMEP)", "cptUpperMotorEP"],
    ["95939 — Lower Motor EP (TcMEP)", "cptLowerMotorEP"],
    ["95941 — RLN Monitoring", "cptRLNMonitoring"],
  ], f, true);

  const emgRows = cptRows([
    ["95907 — 2 Ext. EMG", "cptTwoExtEMG"],
    ["95908 — 4 Ext. EMG", "cptFourExtEMG"],
    ["92585 — Cranial (Unilateral)", "cptCranialUnilateral"],
    ["92586 — Cranial (Bilateral)", "cptCranialBilateral"],
    ["95955 — Electrocorticography", "cptElectrocorticography"],
    ["Stat Fee", "cptStatFee"],
    [`95940 — Standby (${f("standbyHours") || "0"} hrs)`, "cptStandby"],
  ], f, true);

  const techSig = f("technicianSignature");
  const rnSig = f("rnSignature");

  const techSigCell: Content = techSig.startsWith("data:image")
    ? { stack: [{ text: "Technician Signature:", bold: true, marginBottom: 2 }, { image: techSig, width: 140, height: 45 }] }
    : { text: "" };

  const rnSigCell: Content = rnSig.startsWith("data:image")
    ? { stack: [{ text: "RN Signature:", bold: true, marginBottom: 2 }, { image: rnSig, width: 140, height: 45 }] }
    : { text: "" };

  const docDef: TDocumentDefinitions = {
    defaultStyle: { font: "Helvetica", fontSize: 8.5 },
    pageMargins: [36, 50, 36, 50],
    content: [
      // ── Company Header ──────────────────────────────────────────────
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: co.name || " ", style: "companyName" },
              { text: co.address || " ", style: "companyAddress" },
              { text: contactLine || " ", style: "companyAddress" },
            ],
          },
          {
            width: "auto",
            stack: [{ text: "BILLING SHEET", style: "docTitle" }],
            alignment: "right" as const,
          },
        ],
        marginBottom: 6,
      } as Content,
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 1.5, lineColor: "#1a365d" }], marginBottom: 8 },

      // ── Header Info ─────────────────────────────────────────────────
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [
            [
              field("Invoice #", f("invoiceNumber")),
              field("PO #", f("poNumber")),
              field("Patient Name", f("patientName")),
              field("Age", f("age")),
            ] as TableCell[],
            [
              {
                text: [
                  { text: "Gender: ", bold: true },
                  b("genderMale") ? "☑ Male  " : "☐ Male  ",
                  b("genderFemale") ? "☑ Female" : "☐ Female",
                ],
              } as TableCell,
              field("Referring Doctor", f("referringDoctor")) as TableCell,
              field("Room #", f("roomNumber")) as TableCell,
              field("Patient Acct #", f("patientAcctNumber")) as TableCell,
              field("Patient MRN", f("patientMRN")) as TableCell,
            ] as TableCell[],
            [
              field("Tech Name", f("techName")),
              field("Facility", f("facility")),
              field("Date", f("date")),
              field("Procedure", f("procedure")),
            ] as TableCell[],
          ],
        },
        layout: "lightHorizontalLines",
        marginBottom: 10,
      } as Content,

      // ── CPT Codes — two panels side by side ──────────────────────────
      {
        columns: [
          {
            width: "48%",
            table: {
              widths: ["*", 40],
              body: [
                [
                  { text: "Evoked Potentials", style: "sectionHeader", colSpan: 2, alignment: "center" as const } as TableCell,
                  {} as TableCell,
                ],
                [
                  { text: "CPT Code / Description", bold: true } as TableCell,
                  { text: "Used", bold: true, alignment: "center" as const } as TableCell,
                ],
                ...evokedRows,
              ],
            },
            layout: "lightHorizontalLines",
          },
          { width: "4%", text: "" },
          {
            width: "48%",
            table: {
              widths: ["*", 40],
              body: [
                [
                  { text: "EMG / Nerve Conduction", style: "sectionHeader", colSpan: 2, alignment: "center" as const } as TableCell,
                  {} as TableCell,
                ],
                [
                  { text: "CPT Code / Description", bold: true } as TableCell,
                  { text: "Used", bold: true, alignment: "center" as const } as TableCell,
                ],
                ...emgRows,
              ],
            },
            layout: "lightHorizontalLines",
          },
        ],
        marginBottom: 10,
      } as Content,

      // ── EEG & MEP Monitoring ─────────────────────────────────────────
      {
        table: {
          widths: ["*", 40],
          body: [
            [
              { text: "EEG & MEP Monitoring", style: "sectionHeader", colSpan: 2, alignment: "center" as const } as TableCell,
              {} as TableCell,
            ],
            [
              { text: "CPT Code / Description", bold: true } as TableCell,
              { text: "Used", bold: true, alignment: "center" as const } as TableCell,
            ],
            ...cptRows([
              ["95955 — Electroencephalography (Continuous EEG)", "cptEEG"],
              ["Motor Evoked Potentials", "flatFeeMEP"],
            ], f, true),
            [
              { text: "Baseline", bold: true } as TableCell,
              { text: f("baseline"), alignment: "center" as const } as TableCell,
            ],
          ],
        },
        layout: "lightHorizontalLines",
        marginBottom: 10,
      } as Content,

      // ── Timing & Equipment ───────────────────────────────────────────
      {
        table: {
          widths: ["*", 60, "*", 60, "*", 60],
          body: [
            [
              { text: "Timing & Equipment", style: "sectionHeader", colSpan: 6, alignment: "center" as const } as TableCell,
              {} as TableCell, {} as TableCell, {} as TableCell, {} as TableCell, {} as TableCell,
            ],
            [
              { text: "Start Time", bold: true } as TableCell,
              { text: f("startTime"), alignment: "center" as const } as TableCell,
              { text: "End Time", bold: true } as TableCell,
              { text: f("endTime"), alignment: "center" as const } as TableCell,
              { text: "Electrodes Used", bold: true } as TableCell,
              { text: f("electrodesUsed"), alignment: "center" as const } as TableCell,
            ],
            [
              { text: "Thyroid Kit", bold: true } as TableCell,
              { text: f("thyroidKit"), alignment: "center" as const } as TableCell,
              { text: "SSEP/EMG", bold: true } as TableCell,
              { text: f("ssepEMG"), alignment: "center" as const } as TableCell,
              { text: "Fluobeam", bold: true } as TableCell,
              { text: f("fluobeam"), alignment: "center" as const } as TableCell,
            ],
            [
              { text: "Needles Used", bold: true } as TableCell,
              { text: f("needlesUsed"), alignment: "center" as const } as TableCell,
              { text: "Needles Removed", bold: true } as TableCell,
              { text: f("needlesRemoved"), alignment: "center" as const } as TableCell,
              { text: "Driving Time (min)", bold: true } as TableCell,
              { text: f("drivingTime"), alignment: "center" as const } as TableCell,
            ],
            [
              { text: "Pedicle Probe", bold: true } as TableCell,
              { text: f("pedicleProbe") === "yes" ? "Yes" : "No", alignment: "center" as const } as TableCell,
              { text: "Pedicle Probe Qty", bold: true } as TableCell,
              { text: f("pedicleProbeQty"), alignment: "center" as const } as TableCell,
              { text: "" } as TableCell,
              { text: "" } as TableCell,
            ],
          ],
        },
        layout: "lightHorizontalLines",
        marginBottom: 10,
      } as Content,

      // ── Summary ──────────────────────────────────────────────────────
      {
        table: {
          widths: ["*", 80, "*", 80, "*", 80, "*", 80],
          body: [
            [
              { text: "Summary", style: "sectionHeader", colSpan: 8, alignment: "center" as const } as TableCell,
              {} as TableCell, {} as TableCell, {} as TableCell,
              {} as TableCell, {} as TableCell, {} as TableCell, {} as TableCell,
            ],
            [
              { text: "Total Hours", bold: true } as TableCell,
              { text: f("totalHours"), alignment: "center" as const } as TableCell,
              { text: "Computer Used", bold: true } as TableCell,
              { text: f("computerUsed"), alignment: "center" as const } as TableCell,
              { text: "Cancellation", bold: true } as TableCell,
              { text: f("cancellation"), alignment: "center" as const } as TableCell,
              { text: "Neurologist", bold: true } as TableCell,
              { text: f("neurologist"), alignment: "center" as const } as TableCell,
            ],
          ],
        },
        layout: "lightHorizontalLines",
        marginBottom: 12,
      } as Content,

      // ── Signatures ───────────────────────────────────────────────────
      {
        table: {
          widths: ["*", "*", 90],
          body: [
            [
              {
                text: [
                  { text: "Technician Signature: ", bold: true },
                  techSig ? "" : "___________________",
                ],
              } as TableCell,
              techSigCell as TableCell,
              { text: [{ text: "Date: ", bold: true }, f("technicianSignatureDate")] } as TableCell,
            ],
          ],
        },
        layout: "lightHorizontalLines",
        marginBottom: 6,
      } as Content,
      {
        table: {
          widths: ["*", "*", 90],
          body: [
            [
              {
                text: [
                  { text: "RN Signature: ", bold: true },
                  rnSig ? "" : "___________________",
                ],
              } as TableCell,
              rnSigCell as TableCell,
              { text: [{ text: "Date: ", bold: true }, f("rnSignatureDate")] } as TableCell,
            ],
          ],
        },
        layout: "lightHorizontalLines",
      } as Content,
    ],

    styles: {
      companyName: { fontSize: 13, bold: true, color: "#1a365d" },
      companyAddress: { fontSize: 8, color: "#444" },
      docTitle: { fontSize: 14, bold: true, color: "#1a365d" },
      sectionHeader: { fontSize: 9, bold: true, fillColor: "#dce6f1", color: "#1a365d" },
    },
  };

  const doc = await printer.createPdfKitDocument(docDef);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
