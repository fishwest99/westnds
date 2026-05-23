import * as fs from "fs";
import * as path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CompanyHeader } from "./load-form-company";

const TEMPLATE_PATH = path.join(__dirname, "..", "assets", "medical-lien-template.pdf");

export async function generateMedicalLienPdf(
  form: Record<string, unknown>,
  _company?: CompanyHeader,
): Promise<Buffer> {
  const str = (key: string): string => {
    const v = form[key];
    if (v === undefined || v === null) return "";
    return String(v).trim();
  };

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pdfForm = pdfDoc.getForm();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const setText = (name: string, value: string, fontSize = 11) => {
    try {
      const field = pdfForm.getTextField(name);
      field.setFontSize(fontSize);
      field.setText(value);
    } catch {
      // missing field — ignore
    }
  };

  // Header text fields (top of page)
  setText("Text3", str("patientName"), 11);
  setText("Text4", str("dateOfAccident"), 11);
  setText("Text5", str("dateOfSurgery"), 11);

  // Lower printed-name + date fields
  setText("Patient  Authorized Representative  Name", str("patientRepName") || str("patientName"), 11);
  setText("Patients Attorney  Name", str("attorneyName"), 11);
  setText("Date", str("patientDate"), 11);
  setText("Date_2", str("attorneyDate"), 11);

  // Grab signature widget rectangles BEFORE flattening so we can overlay images.
  let patSigRect: { x: number; y: number; width: number; height: number } | null = null;
  let attySigRect: { x: number; y: number; width: number; height: number } | null = null;
  try {
    const w = pdfForm.getField("Signature1_es_:signer:signature").acroField.getWidgets()[0];
    if (w) patSigRect = w.getRectangle();
  } catch {
    /* ignore */
  }
  try {
    const w = pdfForm.getField("Signature2_es_:signer:signature").acroField.getWidgets()[0];
    if (w) attySigRect = w.getRectangle();
  } catch {
    /* ignore */
  }

  pdfForm.flatten();

  const page = pdfDoc.getPage(0);

  const drawSig = async (
    dataUri: string,
    rect: { x: number; y: number; width: number; height: number } | null,
  ) => {
    if (!rect || !dataUri.startsWith("data:image/")) return;
    try {
      const isPng = dataUri.startsWith("data:image/png");
      const b64 = dataUri.replace(/^data:image\/(png|jpeg);base64,/, "");
      const bytes = Buffer.from(b64, "base64");
      const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      page.drawImage(img, {
        x: rect.x + 2,
        y: rect.y - 2,
        width: rect.width - 4,
        height: rect.height + 4,
      });
    } catch {
      /* ignore broken image data */
    }
  };

  await drawSig(str("patientSignature"), patSigRect);
  await drawSig(str("attorneySignature"), attySigRect);

  // Stamp IOM charges over the static "IOM Charges: TBD" line if provided.
  const iom = str("iomCharges");
  if (iom) {
    // Wide cover to nuke the template's italic "IOM Charges: TBD".
    page.drawRectangle({
      x: 40,
      y: 588,
      width: 540,
      height: 22,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });
    page.drawText(`IOM Charges: ${iom}`, {
      x: 57,
      y: 597,
      size: 9,
      font: helv,
      color: rgb(0, 0, 0),
    });
  }

  const out = await pdfDoc.save();
  return Buffer.from(out);
}
