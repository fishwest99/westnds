import * as fs from "fs";
import * as path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CompanyHeader } from "./load-form-company";

const TEMPLATE_PATH = path.join(__dirname, "..", "assets", "case-study-template.pdf");

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export async function generateCaseStudyFormPdf(
  form: Record<string, unknown>,
  _company?: CompanyHeader,
): Promise<Buffer> {
  const str = (key: string): string => {
    const v = form[key];
    if (v === undefined || v === null) return "";
    return String(v).trim();
  };

  const selectedProcedures = parseList(form.selectedProcedures);
  const electrodePickupSites = parseList(form.electrodePickupSites);
  const selectedEPNerves = parseList(form.selectedEPNerves);
  const selectedEMGMuscles = parseList(form.selectedEMGMuscles);
  const diabetic = form.diabetic === true || String(form.diabetic ?? "").toLowerCase() === "yes";

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pdfForm = pdfDoc.getForm();
  const helv = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const setText = (name: string, value: string) => {
    try {
      pdfForm.getTextField(name).setText(value);
    } catch {
      // missing field — ignore
    }
  };

  // Map data → 6 text fields in the user's template
  setText("Posterior Cervical", str("craniotomyDiagnosis"));
  setText("Evoked Potential Nerves Used", str("electrodeOther"));
  setText("Note any problems or signal loss 2", str("problemsOrSignalLoss"));
  // Combine patient history with diabetic flag (the template only has one short field)
  const historyText = [
    diabetic ? "Diabetic: Yes" : "Diabetic: No",
    str("patientHistory"),
  ].filter(Boolean).join(" — ");
  setText("Patient history 1", historyText);
  setText("This form must be filled out completely", str("technicianName"));

  // Capture signature rect BEFORE flatten
  let sigRect: { x: number; y: number; width: number; height: number } | null = null;
  try {
    const sig = pdfForm.getField("Signature2_es_:signer:signature");
    const widget = sig.acroField.getWidgets()[0];
    if (widget) sigRect = widget.getRectangle();
  } catch {
    sigRect = null;
  }

  pdfForm.flatten();

  const page = pdfDoc.getPage(0);

  // Date stamp in the top-right corner so the recipient can see when it was completed
  const dateStr = str("date");
  if (dateStr) {
    page.drawText(`Date: ${dateStr}`, {
      x: 440,
      y: 745,
      size: 9,
      font: helvNormal,
      color: rgb(0, 0, 0),
    });
  }

  // Draw signature image over the signature line
  if (sigRect) {
    const dataUri = str("technicianSignature");
    if (dataUri.startsWith("data:image/png")) {
      try {
        const base64 = dataUri.replace(/^data:image\/png;base64,/, "");
        const bytes = Buffer.from(base64, "base64");
        const image = await pdfDoc.embedPng(bytes);
        page.drawImage(image, {
          x: sigRect.x + 2,
          y: sigRect.y - 4,
          width: sigRect.width - 4,
          height: sigRect.height + 14,
        });
      } catch {
        // ignore
      }
    }
  }

  // ── Page 2: Selections Summary ────────────────────────────────────────
  // The template asks to "circle the completed procedures" — since the tech
  // selects them in the app, list them cleanly on a second page so the
  // recipient sees exactly what was used during the case.
  const hasSelections =
    selectedProcedures.length > 0 ||
    electrodePickupSites.length > 0 ||
    selectedEPNerves.length > 0 ||
    selectedEMGMuscles.length > 0 ||
    str("procedureOther");

  if (hasSelections) {
    const p2 = pdfDoc.addPage([612, 792]);
    let y = 740;

    p2.drawText("Case Study — Selections Summary", {
      x: 72, y, size: 14, font: helv, color: rgb(0.1, 0.2, 0.45),
    });
    y -= 8;
    p2.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 1, color: rgb(0.1, 0.2, 0.45) });
    y -= 22;

    p2.drawText(`Patient: ${str("patientName") || "—"}`, { x: 72, y, size: 10, font: helvNormal });
    p2.drawText(`Date: ${dateStr || "—"}`, { x: 320, y, size: 10, font: helvNormal });
    p2.drawText(`Technician: ${str("technicianName") || "—"}`, { x: 420, y, size: 10, font: helvNormal });
    y -= 24;

    const drawSection = (title: string, items: string[], extra?: string) => {
      const has = items.length > 0 || (extra && extra.trim());
      if (!has) return;
      p2.drawText(title, { x: 72, y, size: 11, font: helv, color: rgb(0.1, 0.2, 0.45) });
      y -= 14;
      const body = items.join(", ") + (extra ? `${items.length ? "  •  " : ""}Other: ${extra}` : "");
      // wrap text manually at ~85 chars
      const words = body.split(" ");
      let line = "";
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (next.length > 95) {
          p2.drawText(line, { x: 84, y, size: 10, font: helvNormal });
          y -= 13;
          line = w;
        } else {
          line = next;
        }
      }
      if (line) {
        p2.drawText(line, { x: 84, y, size: 10, font: helvNormal });
        y -= 13;
      }
      y -= 8;
    };

    drawSection("Procedures (circled)", selectedProcedures, str("procedureOther"));
    drawSection("Electrode pickup sites", electrodePickupSites, str("electrodeOther"));
    drawSection("Evoked Potential nerves used", selectedEPNerves);
    drawSection("EMG muscles used", selectedEMGMuscles);

    if (diabetic) {
      p2.drawText("Diabetic: Yes", { x: 72, y, size: 11, font: helv, color: rgb(0.7, 0.1, 0.1) });
      y -= 18;
    }

    const problems = str("problemsOrSignalLoss");
    if (problems) {
      p2.drawText("Problems / signal loss:", { x: 72, y, size: 11, font: helv, color: rgb(0.1, 0.2, 0.45) });
      y -= 14;
      p2.drawText(problems, { x: 84, y, size: 10, font: helvNormal, maxWidth: 456, lineHeight: 13 });
      y -= 32;
    }

    const hist = str("patientHistory");
    if (hist) {
      p2.drawText("Patient history:", { x: 72, y, size: 11, font: helv, color: rgb(0.1, 0.2, 0.45) });
      y -= 14;
      p2.drawText(hist, { x: 84, y, size: 10, font: helvNormal, maxWidth: 456, lineHeight: 13 });
    }
  }

  const out = await pdfDoc.save();
  return Buffer.from(out);
}
