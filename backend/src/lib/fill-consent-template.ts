import { PDFDocument, PDFTextField } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";

const TEMPLATE_PATH = join(import.meta.dir, "..", "..", "templates", "consent-form.pdf");

const X = "X";
const checkMark = (v: unknown): string => (v ? X : "");
const str = (v: unknown): string => String(v ?? "");

export async function fillConsentTemplate(form: Record<string, unknown>): Promise<Buffer> {
  const bytes = readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(bytes);
  const pdfForm = pdfDoc.getForm();

  const setText = (fieldName: string, value: string): void => {
    try {
      const field = pdfForm.getField(fieldName);
      if (field instanceof PDFTextField) {
        field.setText(value);
      }
    } catch {
      // Field not found — skip silently
    }
  };

  // Company — always check both per business rule
  setText("West NDx Reading", X);
  setText("West NDx Services", X);

  // Patient header
  setText("Patient Facility Sticker Here  R E Q U I R E D", str(form.patientName));
  setText("Date of Birth", str(form.dateOfBirth));
  setText("Surgeon  Physician Name", str(form.surgeonName));
  setText("Date of Service", str(form.dateOfService));
  setText("Procedure", str(form.procedure));

  // Modalities
  setText("ABR", checkMark(form.modalityABR));
  setText("TEMG", checkMark(form.modalityTEMG));
  setText("EEG", checkMark(form.modalityEEG));
  setText("TO4 NMJ", checkMark(form.modalityTO4NMJ));
  setText("EMG", checkMark(form.modalityEMG));
  setText("VEP", checkMark(form.modalityVEP));
  setText("NVC", checkMark(form.modalityNVC));
  setText("SSEP", checkMark(form.modalitySSEP));
  setText("TcMEP", checkMark(form.modalityTcMEP));

  // TcMEP Concerns
  setText("None", checkMark(form.tcmepNone));
  setText("Implants", checkMark(form.tcmepImplants));
  setText("Spinal Cord", checkMark(form.tcmepSpinalCord));
  setText("Seizures", checkMark(form.tcmepSeizures));
  setText("Skull Defects", checkMark(form.tcmepSkullDefects));
  setText("Defibrillator", checkMark(form.tcmepDefibrillator));
  setText("Cochlear Implant", checkMark(form.tcmepCochlearImpl));
  setText("DBS", checkMark(form.tcmepDBS));

  // Symptoms
  setText("Ataxia", checkMark(form.symptomAtaxia));
  setText("Headaches", checkMark(form.symptomHeadaches));
  setText("Pain", checkMark(form.symptomPain));
  setText("Vision", checkMark(form.symptomVision));
  setText("Balance", checkMark(form.symptomBalance));
  setText("Hearing", checkMark(form.symptomHearing));
  setText("Paralysis", checkMark(form.symptomParalysis));
  setText("Vomiting", checkMark(form.symptomVomiting));
  setText("Burning", checkMark(form.symptomBurning));
  setText("Incontinence", checkMark(form.symptomIncontinence));
  setText("Spasticity", checkMark(form.symptomSpasticity));
  setText("Weakness", checkMark(form.symptomWeakness));
  setText("Cognitive", checkMark(form.symptomCognitive));
  setText("Memory", checkMark(form.symptomMemory));
  setText("Speech", checkMark(form.symptomSpeech));
  setText("Naseau", checkMark(form.symptomNaseau));
  setText("Stroke", checkMark(form.symptomStroke));
  setText("Dizziness", checkMark(form.symptomDizziness));
  setText("Numbness", checkMark(form.symptomNumbness));
  setText("Tingling", checkMark(form.symptomTingling));

  // Other / Medical history
  setText("Other", str(form.symptomOtherText));
  setText("Other Pertinent Medical History", str(form.otherMedicalHistory));

  // Acknowledgments (6 undefined fields — best-guess mapping; first 5 = ack checkboxes)
  setText("undefined_5", checkMark(form.ackInformedConsent));
  setText("undefined_6", checkMark(form.ackAssignmentRights));
  setText("undefined_7", checkMark(form.ackAuthRelease));
  setText("undefined_8", checkMark(form.ackSurpriseBalance));
  setText("undefined_9", checkMark(form.ackFinancialResp));
  // undefined_10 left blank — may be the modality "Other" text or similar; awaiting user confirmation

  // Patient signature block
  setText("Patient Name", str(form.patientGuardianName));
  setText("Signature1_es_:signer:signature", str(form.patientGuardianName));
  setText("Date5_es_:signer:date", str(form.patientSignatureDate));

  // Technician block
  setText("Technician Name", str(form.technicianName));
  setText("Signature2_es_:signer:signature", str(form.technicianName));
  setText("Date6_es_:signer:date", str(form.technicianDate));

  pdfForm.flatten();
  const out = await pdfDoc.save();
  return Buffer.from(out);
}
