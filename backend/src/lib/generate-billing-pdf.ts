import * as fs from "fs";
import * as path from "path";
import { PDFDocument } from "pdf-lib";
import type { CompanyHeader } from "./load-form-company";

const TEMPLATE_PATH = path.join(__dirname, "..", "assets", "billing-sheet-template.pdf");

export async function generateBillingFormPdf(
  form: Record<string, unknown>,
  _company?: CompanyHeader,
): Promise<Buffer> {
  const str = (key: string): string => {
    const v = form[key];
    if (v === undefined || v === null) return "";
    return String(v).trim();
  };
  const isYes = (key: string): boolean => {
    const v = form[key];
    return v === true || String(v ?? "").toLowerCase() === "yes";
  };

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pdfForm = pdfDoc.getForm();

  const setText = (name: string, value: string) => {
    try {
      pdfForm.getTextField(name).setText(value);
    } catch {
      // field missing in template — ignore
    }
  };
  const setCheckmark = (name: string, on: boolean) => setText(name, on ? "X" : "");
  const setUsed = (name: string, on: boolean, qty?: string) => {
    if (!on) return setText(name, "");
    setText(name, qty && qty.trim() ? qty.trim() : "1");
  };

  // ── Header
  setText("Invoice", str("invoiceNumber"));
  setText("PO", str("poNumber"));
  setText("Name", str("patientName"));
  setText("Age", str("age"));
  setCheckmark("Male", isYes("genderMale"));
  setCheckmark("Female", isYes("genderFemale"));
  setText("Referring Doctor", str("referringDoctor"));
  setText("Room", str("roomNumber"));
  setText("Patient", str("patientMRN") || str("patientAcctNumber"));
  setText("Tech", str("techName"));
  setText("Facility", str("facility"));
  setText("Date", str("date"));
  setText("Procedure", str("procedure"));

  // ── Modalities — Evoked Potentials (left column)
  setUsed("95930 x", isYes("cptVisual"));
  setUsed("92585 x", isYes("cptAuditory"));
  setUsed("95938 x", isYes("cptUpperExtremities"));
  setUsed("95938 x_2", isYes("cptLowerExtremities"));
  setUsed("95939 x", isYes("cptUpperMotorEP"));
  setUsed("95939 x_2", isYes("cptLowerMotorEP"));
  setUsed("95870 x", isYes("cptRLNMonitoring"));

  // ── Modalities — EMG / Nerve Conduction (right column)
  setUsed("95861 x", isYes("cptTwoExtEMG"));
  setUsed("95864 x", isYes("cptFourExtEMG"));
  setUsed("95870 x_2", isYes("cptCranialUnilateral"));
  setUsed("95870 x_3", isYes("cptCranialBilateral"));
  setUsed("95829 x", isYes("cptElectrocorticography"));
  setUsed("00000 x", isYes("cptStatFee"));
  // "x" is the Standby field — show hours if standby was used
  setText("x", isYes("cptStandby") ? str("standbyHours") || "1" : "");

  // ── EEG & MEP Flat Fee
  setUsed("95955 x 1", isYes("cptEEG"));
  setUsed("95955 x 2", isYes("flatFeeMEP"));
  setText("Baseline", str("baseline"));

  // ── Timing / Equipment
  setText("Start Time", str("startTime"));
  setText("End Time", str("endTime"));
  setText("Thyroid KitFacial Kit", str("thyroidKit"));
  setText("SSEPEMG", str("ssepEMG"));
  setText("Fluobeam", str("fluobeam"));
  setText("Needles Used", str("needlesUsed"));
  setText("Needles Removed", str("needlesRemoved"));

  // ── Total / Footer
  setText("TOTAL HOURS  9594095941G0453 SSEPEMGEEG", str("totalHours"));
  setText("Computer used", str("computerUsed"));
  setText("Cancellation", str("cancellation"));
  setText("Neurologist", str("neurologist"));
  setText("Date_2", str("technicianSignatureDate"));
  setText("Date_3", str("rnSignatureDate"));

  // ── Capture signature field positions BEFORE flatten (fields gone after)
  const captureRect = (fieldName: string): { x: number; y: number; width: number; height: number } | null => {
    try {
      const field = pdfForm.getField(fieldName);
      const widget = field.acroField.getWidgets()[0];
      if (!widget) return null;
      return widget.getRectangle();
    } catch {
      return null;
    }
  };
  const techRect = captureRect("Signature1_es_:signer:signature");
  const rnRect = captureRect("Signature2_es_:signer:signature");

  // Flatten so the emailed PDF is read-only and renders cleanly in all viewers
  pdfForm.flatten();

  // ── Draw signature PNGs on top of the (now-flat) signature lines
  const drawSignature = async (
    rect: { x: number; y: number; width: number; height: number } | null,
    dataUri: string,
  ) => {
    if (!rect || !dataUri || !dataUri.startsWith("data:image/png")) return;
    try {
      const base64 = dataUri.replace(/^data:image\/png;base64,/, "");
      const bytes = Buffer.from(base64, "base64");
      const image = await pdfDoc.embedPng(bytes);
      const page = pdfDoc.getPage(0);
      page.drawImage(image, {
        x: rect.x + 2,
        y: rect.y - 4,
        width: rect.width - 4,
        height: rect.height + 14,
      });
    } catch {
      // ignore — leave blank if embed fails
    }
  };

  await drawSignature(techRect, str("technicianSignature"));
  await drawSignature(rnRect, str("rnSignature"));

  const out = await pdfDoc.save();
  return Buffer.from(out);
}
