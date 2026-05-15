import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";

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

export async function generateMedicalLienPdf(form: Record<string, unknown>): Promise<Buffer> {
  const f = (key: string): string => String(form[key] ?? "");

  const patSig = f("patientSignature");
  const attySig = f("attorneySignature");

  const patSigContent: Content = patSig.startsWith("data:image")
    ? { image: patSig, width: 140, height: 45 }
    : { text: "_______________________________" };

  const attySigContent: Content = attySig.startsWith("data:image")
    ? { image: attySig, width: 140, height: 45 }
    : { text: "_______________________________" };

  const bodyText = `This Medical Lien Agreement ("Agreement") is entered into by and between the undersigned patient ("Patient") and the medical provider(s) listed below, and is intended to create a binding lien on any settlement, judgment, or recovery arising from the Patient's personal injury claim.`;

  const docDef: TDocumentDefinitions = {
    defaultStyle: { font: "Helvetica", fontSize: 9 },
    pageMargins: [50, 60, 50, 60],
    content: [
      // Header logos area - text-based since we don't have logos
      {
        columns: [
          { width: "*", text: [{ text: "West Neurodiagnostic Reading", bold: true, color: "#8B0000" }, "\nNEUROPHYSIOLOGICAL MONITORING"] },
          { width: "*", text: [{ text: "West Neurodiagnostic Services", bold: true, color: "#00008B" }, "\nINTRAOPERATIVE NEUROMONITORING"], alignment: "right" as const },
        ],
        marginBottom: 8,
      } as Content,
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 1.5, lineColor: "#333" }], marginBottom: 12 },

      // Title
      { text: "MEDICAL LIEN AGREEMENT", style: "docTitle", alignment: "center" as const, marginBottom: 14 } as Content,

      // Fillable header fields
      { text: [{ text: "Patient Printed Name:  ", bold: true, color: "#8B6914" }, f("patientName")], marginBottom: 6 } as Content,
      { text: [{ text: "Date of Accident/Injury:  ", bold: true, color: "#8B6914" }, f("dateOfAccident")], marginBottom: 6 } as Content,
      { text: [{ text: "Date of Surgery:  ", bold: true, color: "#8B6914" }, f("dateOfSurgery")], marginBottom: 6 } as Content,
      { text: [{ text: "IOM Charges:  ", italics: true, color: "#8B6914" }, f("iomCharges")], marginBottom: 12 } as Content,

      // Body text
      { text: bodyText, marginBottom: 12 } as Content,

      // PARTIES
      { text: "PARTIES", bold: true, marginBottom: 4 } as Content,
      { text: "This Agreement is made between:", marginLeft: 20, marginBottom: 3 } as Content,
      { text: "Medical Provider(s):  WEST NDX - READING and/or WEST NDX - SERVICES", marginLeft: 36, marginBottom: 3 } as Content,
      { text: "Attorney(s) Representing Patient / Case Manager", marginLeft: 36, marginBottom: 12 } as Content,

      // AUTHORIZATION TO PAY PROVIDER
      { text: "AUTHORIZATION TO PAY PROVIDER", bold: true, marginBottom: 4 } as Content,
      {
        text: "The undersigned Patient hereby authorizes and irrevocably instructs their attorney(s) to pay directly to Provider any and all sums due for medical services rendered to the Patient from the proceeds of any settlement, judgment, or verdict obtained in connection with the personal injury claim arising from the incident described above.",
        marginLeft: 20, marginBottom: 12,
      } as Content,

      // NOTICE OF LIEN
      { text: "NOTICE OF LIEN", bold: true, marginBottom: 4 } as Content,
      {
        text: "This document shall serve as formal notice to the attorney(s) of the Provider's lien against any recovery obtained by or on behalf of the Patient. The lien is effective immediately upon the Provider's rendering of services, and shall remain valid and enforceable regardless of whether the attorney(s) execute this Agreement below.",
        marginLeft: 20, marginBottom: 12,
      } as Content,

      // PATIENT'S PERSONAL LIABILITY
      { text: "PATIENT'S PERSONAL LIABILITY", bold: true, marginBottom: 4 } as Content,
      {
        text: "The Patient acknowledges and agrees that they remain fully and personally responsible for all charges for medical services rendered by the Provider, regardless of the outcome of the personal injury claim. The Patient's obligation to pay is not contingent upon any recovery from an insurer, defendant, or third party.",
        marginLeft: 20, marginBottom: 12,
      } as Content,

      // ATTORNEY'S ACKNOWLEDGMENT
      { text: "ATTORNEY'S ACKNOWLEDGMENT (Optional)", bold: true, marginBottom: 4 } as Content,
      {
        text: "The undersigned attorney acknowledges receipt of this lien and agrees to honor its terms to the extent allowed by law.",
        marginLeft: 20, marginBottom: 20,
      } as Content,

      // Signatures — two columns
      {
        columns: [
          {
            width: "48%",
            stack: [
              patSigContent,
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5 }] } as Content,
              { text: "Patient / Authorized Representative - Signature", fontSize: 8, color: "#555", marginTop: 3, marginBottom: 10 } as Content,
              { text: f("patientRepName") || " ", marginBottom: 3 } as Content,
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5 }] } as Content,
              { text: "Patient / Authorized Representative - Name", fontSize: 8, color: "#555", marginTop: 3, marginBottom: 10 } as Content,
              { text: f("patientDate") || " ", marginBottom: 3 } as Content,
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 100, y2: 0, lineWidth: 0.5 }] } as Content,
              { text: "Date", fontSize: 8, color: "#555", marginTop: 3 } as Content,
            ],
          },
          { width: "4%", text: "" },
          {
            width: "48%",
            stack: [
              attySigContent,
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5 }] } as Content,
              { text: "Patient's Attorney - Signature", fontSize: 8, color: "#555", marginTop: 3, marginBottom: 10 } as Content,
              { text: f("attorneyName") || " ", marginBottom: 3 } as Content,
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5 }] } as Content,
              { text: "Patient's Attorney - Name", fontSize: 8, color: "#555", marginTop: 3, marginBottom: 10 } as Content,
              { text: f("attorneyDate") || " ", marginBottom: 3 } as Content,
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 100, y2: 0, lineWidth: 0.5 }] } as Content,
              { text: "Date", fontSize: 8, color: "#555", marginTop: 3 } as Content,
            ],
          },
        ],
        marginBottom: 20,
      } as Content,

      // Footer
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.5, lineColor: "#555" }], marginBottom: 6 },
      { text: "17345 Falling Creek Avenue, Bakersfield, CA 93314", alignment: "center" as const, fontSize: 9, color: "#333" } as Content,
    ],

    styles: {
      docTitle: { fontSize: 16, bold: true },
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
