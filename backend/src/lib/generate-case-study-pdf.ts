import * as fs from "fs";
import * as path from "path";
import { PDFDocument, StandardFonts, rgb, PDFPage } from "pdf-lib";
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

// Positions of every selectable label on the template (extracted from the PDF
// content stream). y is the text baseline, w is the visible glyph width.
const PROCEDURE_POS: Record<string, { x: number; y: number; w: number }> = {
  // Cervical row (y=629.41)
  "ACDF": { x: 72, y: 629.4, w: 32 },
  "Posterior Cervical": { x: 144, y: 629.4, w: 100 },
  "C1": { x: 252, y: 629.4, w: 14 },
  "C2": { x: 288, y: 629.4, w: 14 },
  "C3": { x: 324, y: 629.4, w: 14 },
  "C4": { x: 360, y: 629.4, w: 14 },
  "C5": { x: 396, y: 629.4, w: 14 },
  "C6": { x: 432, y: 629.4, w: 14 },
  "C7": { x: 468, y: 629.4, w: 14 },
  "C8": { x: 504, y: 629.4, w: 14 },
  // Lumbar/Other row (y=598.57)
  "Lumbar Laminectomy": { x: 72, y: 598.6, w: 117 },
  "Microdiscectomy": { x: 189, y: 598.6, w: 90 },
  "Fusion": { x: 296, y: 598.6, w: 34 },
  "ALIF": { x: 348, y: 598.6, w: 24 },
  "XLIF": { x: 386, y: 598.6, w: 26 },
  "TLIF": { x: 411, y: 598.6, w: 24 },
  "Hardware Removal": { x: 456, y: 598.6, w: 96 },
  // Thoracic row (y=567.61)
  "T1": { x: 72, y: 567.6, w: 14 },
  "T2": { x: 108, y: 567.6, w: 14 },
  "T3": { x: 144, y: 567.6, w: 14 },
  "T4": { x: 180, y: 567.6, w: 14 },
  "T5": { x: 216, y: 567.6, w: 14 },
  "T6": { x: 252, y: 567.6, w: 14 },
  "T7": { x: 288, y: 567.6, w: 14 },
  "T8": { x: 324, y: 567.6, w: 14 },
  "T9": { x: 360, y: 567.6, w: 14 },
  "T10": { x: 396, y: 567.6, w: 20 },
  "T11": { x: 432, y: 567.6, w: 20 },
  "T12": { x: 468, y: 567.6, w: 20 },
  // Lumbar row (y=552.26)
  "L1": { x: 72, y: 552.3, w: 14 },
  "L2": { x: 108, y: 552.3, w: 14 },
  "L3": { x: 144, y: 552.3, w: 14 },
  "L4": { x: 180, y: 552.3, w: 14 },
  "L5": { x: 216, y: 552.3, w: 14 },
  "S1": { x: 252, y: 552.3, w: 14 },
};

// Electrode pickup site row (y=521.3) — labels packed across the row
const ELECTRODE_POS: Record<string, { x: number; y: number; w: number }> = {
  "CPZ": { x: 173, y: 521.3, w: 24 },
  "C3": { x: 197, y: 521.3, w: 14 },
  "C4": { x: 228, y: 521.3, w: 14 },
  "FPZ": { x: 279, y: 521.3, w: 22 },
  "A1": { x: 309, y: 521.3, w: 14 },
  "A2": { x: 345, y: 521.3, w: 14 },
  "C1": { x: 381, y: 521.3, w: 14 },
  "C2": { x: 417, y: 521.3, w: 14 },
};

// Evoked Potential nerves (two rows: y=444.12 and y=428.64)
const EP_POS: Record<string, { x: number; y: number; w: number }> = {
  "Median": { x: 72, y: 444.1, w: 38 },
  "Ulnar": { x: 124, y: 444.1, w: 30 },
  "Radial": { x: 166, y: 444.1, w: 32 },
  "C5": { x: 211, y: 444.1, w: 14 },
  "C6": { x: 240, y: 444.1, w: 14 },
  "C7": { x: 268, y: 444.1, w: 14 },
  "C8": { x: 296, y: 444.1, w: 14 },
  "Erbs": { x: 327, y: 444.1, w: 26 },
  "Posterior Tibial": { x: 363, y: 444.1, w: 84 },
  "Peroneal": { x: 459, y: 444.1, w: 48 },
  // Row 2
  "L2": { x: 72, y: 428.6, w: 14 },
  "L3": { x: 108, y: 428.6, w: 14 },
  "L4": { x: 144, y: 428.6, w: 14 },
  "L5": { x: 180, y: 428.6, w: 14 },
  "S1": { x: 216, y: 428.6, w: 14 },
  "Saphenous": { x: 247, y: 428.6, w: 56 },
  "Pop Fossa": { x: 314, y: 428.6, w: 52 },
};

// EMG muscles
const EMG_POS: Record<string, { x: number; y: number; w: number }> = {
  // Row 1 (y=366.84)
  "Trapezius": { x: 72, y: 366.8, w: 50 },
  "Deltoids": { x: 138, y: 366.8, w: 46 },
  "Biceps": { x: 198, y: 366.8, w: 34 },
  "Triceps": { x: 245, y: 366.8, w: 38 },
  "Abductor Pollicis": { x: 296, y: 366.8, w: 86 },
  "Vast. Medialis": { x: 396, y: 366.8, w: 76 },
  "EHL": { x: 485, y: 366.8, w: 22 },
  // Row 2 (y=336.01)
  "Anterior Tibialis": { x: 72, y: 336, w: 86 },
  "Medial Gastrocs": { x: 175, y: 336, w: 86 },
  // Row 3 (y=305.17): "Motors  Uppers  Lowers"
  "Upper MEPs": { x: 132, y: 305.2, w: 42 },
  "Lower MEPs": { x: 188, y: 305.2, w: 42 },
  // Row 4 (y=274.22): "ABR  Right  Left  Hearing Loss"
  "ABR Right": { x: 116, y: 274.2, w: 36 },
  "ABR Left": { x: 166, y: 274.2, w: 30 },
  // Row 5 (y=243.38): "VER  Right  Left"
  "VER Right": { x: 116, y: 243.4, w: 36 },
  "VER Left": { x: 166, y: 243.4, w: 30 },
};

function drawCircle(
  page: PDFPage,
  pos: { x: number; y: number; w: number },
): void {
  const padX = 4;
  const padY = 5;
  const cx = pos.x + pos.w / 2;
  const cy = pos.y + 4;
  const rx = pos.w / 2 + padX;
  const ry = 6 + padY;
  page.drawEllipse({
    x: cx,
    y: cy,
    xScale: rx,
    yScale: ry,
    borderColor: rgb(0.85, 0.1, 0.1),
    borderWidth: 1.3,
  });
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

  setText("Posterior Cervical", str("craniotomyDiagnosis"));
  setText("Evoked Potential Nerves Used", str("electrodeOther"));
  setText("Note any problems or signal loss 2", str("problemsOrSignalLoss"));
  setText("Patient history 1", str("patientHistory"));
  setText("This form must be filled out completely", str("technicianName"));

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

  // Circle each selected item on the template — matches the
  // "Circle the completed procedure[s]" instruction in the form header.
  for (const p of selectedProcedures) {
    const pos = PROCEDURE_POS[p];
    if (pos) drawCircle(page, pos);
  }
  for (const e of electrodePickupSites) {
    const pos = ELECTRODE_POS[e];
    if (pos) drawCircle(page, pos);
  }
  for (const n of selectedEPNerves) {
    const pos = EP_POS[n];
    if (pos) drawCircle(page, pos);
  }
  for (const m of selectedEMGMuscles) {
    const pos = EMG_POS[m];
    if (pos) drawCircle(page, pos);
  }

  if (diabetic) {
    drawCircle(page, { x: 72, y: 166.2, w: 48 });
  }

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

  // ── Page 2: Selections Summary (catches items not on the template)
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
