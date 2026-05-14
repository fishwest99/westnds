import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";

// pdfmake's @types package only covers the browser API; use a require for server-side PdfPrinter
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require("pdfmake/js/Printer").default as new (fonts: import("pdfmake/interfaces").TFontDictionary) => {
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

const printer = new PdfPrinter(fonts);

function field(label: string, value: string): Content {
  return { text: [{ text: `${label}: `, bold: true }, value] };
}

function cptRows(entries: [string, string][], f: (key: string) => string): TableCell[][] {
  return entries.map(([label, key]) => [
    { text: label } as TableCell,
    { text: f(key), alignment: "center" as const } as TableCell,
  ]);
}

export async function generateBillingFormPdf(form: Record<string, unknown>): Promise<Buffer> {
  const f = (key: string): string => String(form[key] ?? "");
  const b = (key: string): boolean => Boolean(form[key]);

  const evokedRows = cptRows([
    ["95930 — Visual EP", "cptVisual"],
    ["95925 — Auditory EP", "cptAuditory"],
    ["95925 — Upper Extremities SSEP", "cptUpperExtremities"],
    ["95926 — Lower Extremities SSEP", "cptLowerExtremities"],
    ["95928 — Upper Motor EP (TcMEP)", "cptUpperMotorEP"],
    ["95929 — Lower Motor EP (TcMEP)", "cptLowerMotorEP"],
    ["95941 — RLN Monitoring", "cptRLNMonitoring"],
  ], f);

  const emgRows = cptRows([
    ["95907 — 2 Ext. EMG", "cptTwoExtEMG"],
    ["95908 — 4 Ext. EMG", "cptFourExtEMG"],
    ["92585 — Cranial (Unilateral)", "cptCranialUnilateral"],
    ["92586 — Cranial (Bilateral)", "cptCranialBilateral"],
    ["95829 — Electrocorticography", "cptElectrocorticography"],
    ["Stat Fee", "cptStatFee"],
    ["95940 — Standby", "cptStandby"],
  ], f);

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
              { text: "West Neurodiagnostic Services, Inc.", style: "companyName" },
              { text: "17345 Falling Creek Avenue, Bakersfield, CA 93314", style: "companyAddress" },
              { text: "Phone: (661) 496-7871    Fax: (661) 587-5453    EIN # 45-0905853", style: "companyAddress" },
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
              field("Patient #", f("patientNumber")) as TableCell,
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
                  { text: "QTY", bold: true, alignment: "center" as const } as TableCell,
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
                  { text: "QTY", bold: true, alignment: "center" as const } as TableCell,
                ],
                ...emgRows,
              ],
            },
            layout: "lightHorizontalLines",
          },
        ],
        marginBottom: 10,
      } as Content,

      // ── EEG / Monitoring ─────────────────────────────────────────────
      {
        table: {
          widths: ["*", 60, "*", 60, "*", 60],
          body: [
            [
              { text: "EEG / Monitoring", style: "sectionHeader", colSpan: 6, alignment: "center" as const } as TableCell,
              {} as TableCell, {} as TableCell, {} as TableCell, {} as TableCell, {} as TableCell,
            ],
            [
              { text: "95816/95819 — EEG", bold: true } as TableCell,
              { text: f("cptEEG"), alignment: "center" as const } as TableCell,
              { text: "Flat Fee MEP", bold: true } as TableCell,
              { text: f("flatFeeMEP"), alignment: "center" as const } as TableCell,
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
              { text: "Needle Count", bold: true } as TableCell,
              { text: f("needleCount"), alignment: "center" as const } as TableCell,
              { text: "Needles Used", bold: true } as TableCell,
              { text: f("needlesUsed"), alignment: "center" as const } as TableCell,
              { text: "Needles Removed", bold: true } as TableCell,
              { text: f("needlesRemoved"), alignment: "center" as const } as TableCell,
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

  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(docDef);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
