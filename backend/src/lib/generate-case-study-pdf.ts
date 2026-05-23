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

// Positions extracted by walking the PDF content stream and tracking each
// glyph's actual x/y using the embedded Calibri font's widths from the
// template's font dictionary. Every label is highlighted pixel-accurately.
const PROCEDURE_POS: Record<string, { x: number; y: number; w: number }> = {
  // Cervical row
  "ACDF": { x: 72.00, y: 629.4, w: 24.21 },
  "Posterior Cervical": { x: 144.00, y: 629.4, w: 78.75 },
  "C1": { x: 252.01, y: 629.4, w: 11.49 },
  "C2": { x: 288.01, y: 629.4, w: 11.49 },
  "C3": { x: 324.01, y: 629.4, w: 11.49 },
  "C4": { x: 360.01, y: 629.4, w: 11.49 },
  "C5": { x: 396.01, y: 629.4, w: 11.49 },
  "C6": { x: 432.01, y: 629.4, w: 11.49 },
  "C7": { x: 468.02, y: 629.4, w: 11.49 },
  "C8": { x: 504.02, y: 629.4, w: 11.49 },
  // Lumbar/Other row
  "Lumbar Laminectomy": { x: 72.02, y: 598.6, w: 97.66 },
  "Microdiscectomy": { x: 188.90, y: 598.6, w: 76.95 },
  "Fusion": { x: 285.65, y: 598.6, w: 29.30 },
  "ALIF": { x: 334.79, y: 598.6, w: 18.93 },
  "XLIF": { x: 373.33, y: 598.6, w: 18.33 },
  "TLIF": { x: 411.62, y: 598.6, w: 18.00 },
  "Hardware Removal": { x: 449.36, y: 598.6, w: 85.56 },
  // Thoracic row
  "T1": { x: 72.02, y: 567.6, w: 10.98 },
  "T2": { x: 108.02, y: 567.6, w: 10.98 },
  "T3": { x: 144.02, y: 567.6, w: 10.98 },
  "T4": { x: 180.03, y: 567.6, w: 10.98 },
  "T5": { x: 216.03, y: 567.6, w: 10.98 },
  "T6": { x: 252.03, y: 567.6, w: 10.98 },
  "T7": { x: 288.03, y: 567.6, w: 10.98 },
  "T8": { x: 324.03, y: 567.6, w: 10.98 },
  "T9": { x: 360.03, y: 567.6, w: 10.98 },
  "T10": { x: 396.04, y: 567.6, w: 16.60 },
  "T11": { x: 432.04, y: 567.6, w: 16.60 },
  "T12": { x: 468.04, y: 567.6, w: 16.60 },
  // Lumbar L1-S1 row
  "L1": { x: 72.03, y: 552.3, w: 10.24 },
  "L2": { x: 108.03, y: 552.3, w: 10.24 },
  "L3": { x: 144.04, y: 552.3, w: 10.24 },
  "L4": { x: 180.04, y: 552.3, w: 10.24 },
  "L5": { x: 216.04, y: 552.3, w: 10.24 },
  "S1": { x: 252.04, y: 552.3, w: 10.66 },
};

const ELECTRODE_POS: Record<string, { x: number; y: number; w: number }> = {
  "CPZ": { x: 179.59, y: 521.3, w: 17.19 },
  "C3": { x: 216.57, y: 521.3, w: 11.47 },
  "C4": { x: 247.89, y: 521.3, w: 11.47 },
  "FPZ": { x: 279.39, y: 521.3, w: 16.13 },
  "A1": { x: 314.97, y: 521.3, w: 12.03 },
  "A2": { x: 346.85, y: 521.3, w: 12.03 },
  "C1": { x: 378.62, y: 521.3, w: 11.55 },
  "C2": { x: 409.90, y: 521.3, w: 11.55 },
  // Mobile-app aliases that map to the same template sites
  "CP3": { x: 216.57, y: 521.3, w: 11.47 },
  "CP4": { x: 247.89, y: 521.3, w: 11.47 },
};

const EP_POS: Record<string, { x: number; y: number; w: number }> = {
  "Median": { x: 72.00, y: 444.1, w: 34.40 },
  "Ulnar": { x: 121.12, y: 444.1, w: 24.52 },
  "Radial": { x: 160.51, y: 444.1, w: 27.41 },
  "C5": { x: 202.67, y: 444.1, w: 11.37 },
  "C6": { x: 228.84, y: 444.1, w: 11.49 },
  "C7": { x: 255.47, y: 444.1, w: 11.59 },
  "C8": { x: 281.96, y: 444.1, w: 11.47 },
  "Erbs": { x: 308.29, y: 444.1, w: 19.49 },
  "Posterior Tibial": { x: 339.96, y: 444.1, w: 67.49 },
  "Peroneal": { x: 422.20, y: 444.1, w: 40.04 },
  // Row 2
  "L2": { x: 72.00, y: 428.6, w: 10.24 },
  "L3": { x: 108.00, y: 428.6, w: 10.24 },
  "L4": { x: 144.00, y: 428.6, w: 10.24 },
  "L5": { x: 180.00, y: 428.6, w: 10.28 },
  "S1": { x: 216.01, y: 428.6, w: 10.66 },
  "Saphenous": { x: 236.55, y: 428.6, w: 49.40 },
  "Pop Fossa": { x: 298.24, y: 428.6, w: 44.67 },
};

const EMG_POS: Record<string, { x: number; y: number; w: number }> = {
  "Trapezius": { x: 72.00, y: 366.8, w: 42.79 },
  "Deltoids": { x: 129.55, y: 366.8, w: 37.02 },
  "Biceps": { x: 181.34, y: 366.8, w: 28.72 },
  "Triceps": { x: 224.93, y: 366.8, w: 31.98 },
  "Abductor Pollicis": { x: 271.68, y: 366.8, w: 74.76 },
  "Vast. Medialis": { x: 361.31, y: 366.8, w: 62.60 },
  "EHL": { x: 438.68, y: 366.8, w: 16.90 },
  // Row 2
  "Anterior Tibialis": { x: 72.00, y: 336.0, w: 70.90 },
  "Medial Gastrocs": { x: 158.33, y: 336.0, w: 72.56 },
  // Motors row — mobile sends "Upper MEPs" / "Lower MEPs" which map to the
  // "Uppers" / "Lowers" labels on the template.
  "Upper MEPs": { x: 119.63, y: 305.2, w: 32.18 },
  "Lower MEPs": { x: 166.41, y: 305.2, w: 31.81 },
  // ABR row
  "ABR Right": { x: 105.25, y: 274.2, w: 23.18 },
  "ABR Left": { x: 143.21, y: 274.2, w: 17.16 },
  // VER row
  "VER Right": { x: 104.47, y: 243.4, w: 23.10 },
  "VER Left": { x: 142.33, y: 243.4, w: 17.11 },
};

function drawHighlight(
  page: PDFPage,
  pos: { x: number; y: number; w: number },
): void {
  // Translucent yellow highlighter — fits the label tightly now that positions
  // are pixel-accurate (extracted from the embedded font's Widths array).
  page.drawRectangle({
    x: pos.x - 1.5,
    y: pos.y - 2,
    width: pos.w + 3,
    height: 13,
    color: rgb(1.0, 0.92, 0.25),
    opacity: 0.5,
    borderWidth: 0,
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

  // Cover the "(Circle the completed procedures)" subtitle baked into the
  // template and replace it with "(Highlight the completed procedures)" so the
  // instruction matches what the app actually does (yellow highlighting, not
  // hand-circling).
  page.drawRectangle({
    x: 232,
    y: 682,
    width: 152,
    height: 12,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });
  page.drawText("(Highlight the completed procedures)", {
    x: 232,
    y: 685.56,
    size: 8,
    font: helvNormal,
    color: rgb(0, 0, 0),
  });

  // Yellow highlighter over every selected label on the template.
  const unmapped: string[] = [];
  const mark = (
    list: string[],
    map: Record<string, { x: number; y: number; w: number }>,
    category: string,
  ) => {
    for (const item of list) {
      const pos = map[item];
      if (pos) drawHighlight(page, pos);
      else unmapped.push(`${category}: ${item}`);
    }
  };

  mark(selectedProcedures, PROCEDURE_POS, "Procedure");
  mark(electrodePickupSites, ELECTRODE_POS, "Electrode");
  mark(selectedEPNerves, EP_POS, "EP Nerve");
  mark(selectedEMGMuscles, EMG_POS, "EMG Muscle");

  if (diabetic) {
    drawHighlight(page, { x: 72.01, y: 166.2, w: 39.75 });
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

  // ── Page 2: clean printed list of every selection (covers items like
  // Cranial Nerve procedures that the template has no row for).
  const hasSelections =
    selectedProcedures.length > 0 ||
    electrodePickupSites.length > 0 ||
    selectedEPNerves.length > 0 ||
    selectedEMGMuscles.length > 0 ||
    str("procedureOther") ||
    str("electrodeOther");

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

    drawSection("Procedures", selectedProcedures, str("procedureOther"));
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
