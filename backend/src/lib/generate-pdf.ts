import type { TDocumentDefinitions, Content, TFontDictionary } from "pdfmake/interfaces";

// pdfmake's @types package only covers the browser API; use a require for server-side PdfPrinter
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require("pdfmake/js/Printer").default as new (fonts: TFontDictionary) => {
  createPdfKitDocument(docDefinition: TDocumentDefinitions, options?: Record<string, unknown>): NodeJS.EventEmitter & { end(): void };
};

const fonts: TFontDictionary = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const printer = new PdfPrinter(fonts);

function check(val: boolean | null | undefined): string {
  return val ? "☑" : "☐";
}

export async function generateConsentFormPdf(form: Record<string, unknown>): Promise<Buffer> {
  const docDef: TDocumentDefinitions = {
    defaultStyle: { font: "Helvetica", fontSize: 9 },
    pageMargins: [40, 50, 40, 50],
    content: [
      // Header
      {
        columns: [
          { text: "West NDx", style: "orgName", width: "*" },
          {
            text: "Informed Consent, Assignment of Benefits\nand Financial Responsibility for\nIntraoperative Neuromonitoring Services",
            style: "headerTitle",
            alignment: "right",
            width: "60%",
          },
        ],
        marginBottom: 10,
      },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#1a365d" }], marginBottom: 8 },

      // Company checkboxes
      {
        columns: [
          { text: "Company(ies) providing IOM services this case:", bold: true, width: "auto" },
          { text: `  ${check(form.companyReading as boolean)} West NDx - Reading    ${check(form.companyServices as boolean)} West NDx Services`, width: "*" },
        ],
        marginBottom: 6,
      },

      // Patient info table
      {
        table: {
          widths: ["*", 90],
          body: [
            [
              { text: [{ text: "Patient Name: ", bold: true }, (form.patientName as string) || ""] },
              { text: [{ text: "Date of Birth: ", bold: true }, (form.dateOfBirth as string) || ""] },
            ],
            [
              { text: [{ text: "Surgeon / Physician Name: ", bold: true }, (form.surgeonName as string) || ""] },
              { text: [{ text: "Date of Service: ", bold: true }, (form.dateOfService as string) || ""] },
            ],
            [
              { text: [{ text: "Procedure: ", bold: true }, (form.procedure as string) || ""], colSpan: 2 },
              {},
            ],
          ],
        },
        layout: "lightHorizontalLines",
        marginBottom: 8,
      },

      // Modalities + TcMEP Concerns + Symptoms in 3 columns
      {
        columns: [
          {
            width: "30%",
            stack: [
              { text: "Modalities", bold: true, marginBottom: 3 },
              { text: `${check(form.modalityABR as boolean)} ABR    ${check(form.modalityTEMG as boolean)} T-EMG` },
              { text: `${check(form.modalityEEG as boolean)} EEG    ${check(form.modalityTO4NMJ as boolean)} TO4 (NMJ)` },
              { text: `${check(form.modalityEMG as boolean)} EMG    ${check(form.modalityVEP as boolean)} VEP` },
              { text: `${check(form.modalityNVC as boolean)} NVC    ${check(form.modalitySSEP as boolean)} SSEP` },
              { text: `${check(form.modalityTcMEP as boolean)} TcMEP` },
            ],
          },
          {
            width: "35%",
            stack: [
              { text: "TcMEP Concerns", bold: true, marginBottom: 3 },
              { text: `${check(form.tcmepNone as boolean)} None    ${check(form.tcmepSeizures as boolean)} Seizures` },
              { text: `${check(form.tcmepSkullDefects as boolean)} Skull Defects/Plating` },
              { text: `${check(form.tcmepDefibrillator as boolean)} Defibrillator    ${check(form.tcmepImplants as boolean)} Implants` },
              { text: `${check(form.tcmepSpinalCord as boolean)} Spinal Cord Stimulator` },
              { text: `${check(form.tcmepDBS as boolean)} DBS    ${check(form.tcmepCochlearImpl as boolean)} Cochlear Implant` },
              form.tcmepOtherText ? { text: `Other: ${form.tcmepOtherText as string}` } : null,
            ].filter(Boolean) as Content[],
          },
          {
            width: "35%",
            stack: [
              { text: "Symptoms", bold: true, marginBottom: 3 },
              { text: `${check(form.symptomAtaxia as boolean)} Ataxia    ${check(form.symptomHeadaches as boolean)} Headaches` },
              { text: `${check(form.symptomPain as boolean)} Pain    ${check(form.symptomVision as boolean)} Vision` },
              { text: `${check(form.symptomBalance as boolean)} Balance    ${check(form.symptomHearing as boolean)} Hearing` },
              { text: `${check(form.symptomParalysis as boolean)} Paralysis    ${check(form.symptomVomiting as boolean)} Vomiting` },
              { text: `${check(form.symptomBurning as boolean)} Burning    ${check(form.symptomIncontinence as boolean)} Incontinence` },
              { text: `${check(form.symptomSpasticity as boolean)} Spasticity    ${check(form.symptomWeakness as boolean)} Weakness` },
              { text: `${check(form.symptomCognitive as boolean)} Cognitive    ${check(form.symptomMemory as boolean)} Memory` },
              { text: `${check(form.symptomSpeech as boolean)} Speech    ${check(form.symptomNaseau as boolean)} Naseau` },
              { text: `${check(form.symptomStroke as boolean)} Stroke    ${check(form.symptomDizziness as boolean)} Dizziness` },
              { text: `${check(form.symptomNumbness as boolean)} Numbness    ${check(form.symptomTingling as boolean)} Tingling` },
            ],
          },
        ],
        marginBottom: 8,
      },

      // Other medical history
      {
        table: {
          widths: ["*"],
          body: [[{ text: [{ text: "Other Pertinent Medical History: ", bold: true }, (form.otherMedicalHistory as string) || ""] }]],
        },
        layout: "lightHorizontalLines",
        marginBottom: 10,
      },

      // Legal text
      { text: "Informed Consent", style: "legalHeading" },
      { text: "I hereby authorize West Neurodigmostics-Reading, LLC and West Neurodigmostics-Services, LLC - (West NDx), Out-Of-Network provider(s) to perform Intraoperative Neurophysiologic Monitoring as requested by my surgeon. Testing modalities may include, but are not limited to Transcranial Motor Evoked Potentials (TcMEP), Somatosensory Evoked Potentials (SSEP), Brainstem Auditory Evoked Potentials (BAEP), Electroencephalography (EEG) and Electromyography (EMG). I authorize West NDx to share the data obtained during the monitoring with a Physician, either, in person or via secure internet transmission, for the purpose of interpreting the data.", style: "legalText" },

      { text: "Assignment of Rights and Benefits", style: "legalHeading" },
      { text: "In consideration of the medical services to be provided, I understand that I am responsible for payment for these services in accordance with the rates and terms now in effect at West NDx to the extent that I am legally responsible. I hereby assign West NDx, Physician, or affiliated third-party company any and all benefits and all interest and rights for services rendered under any insurance policy or prepaid healthcare plan. I acknowledge that any Patient Responsibility, including but not limited to Co-Insurance, Out-Of-Pocket, Deductible, etc, that is not covered or paid by such policy, is my legal responsibility.", style: "legalText" },

      { text: "Authorization to Release Information and Appointed Representative", style: "legalHeading" },
      { text: "I authorize West NDx and affiliates to have full and complete access to my hospital medical records and to furnish requested information from my medical records to any insurance or third-party payer. I authorize West NDx to act as my duly appointed representative in the resolution of any unpaid charges, including acting on my behalf during any reconsideration/appeal.", style: "legalText" },

      { text: "Surprise/Balance Billing Disclosure", style: "legalHeading" },
      { text: "I have been made aware that West NDx are out-of-network providers prior to this procedure. The most I can be billed for covered services is my in-network cost-sharing amount. West NDx will not bill me for additional costs.", style: "legalText" },

      { text: "Financial Responsibility", style: "legalHeading" },
      { text: "I hereby authorize West NDx to pursue payment for the IOM services performed on the procedure on this date. My signature below indicates that I consent to these procedures and have been made aware of my benefits and financial responsibility.", style: "legalText" },

      { text: " ", marginBottom: 4 },

      // Signature section
      {
        table: {
          widths: ["*", "*", 80],
          body: [
            [
              { text: [{ text: "Patient or Legal Guardian Name (Print): ", bold: true }, (form.patientGuardianName as string) || ""] },
              { text: [{ text: "Signature: ", bold: true }, { text: (form.patientSignature as string) || "", italics: true }] },
              { text: [{ text: "Date: ", bold: true }, (form.patientSignatureDate as string) || ""] },
            ],
          ],
        },
        layout: "lightHorizontalLines",
        marginBottom: 4,
      },

      // Technician section
      {
        table: {
          widths: ["*", "*", 80],
          body: [
            [
              { text: [{ text: "Technician Name (Print): ", bold: true }, (form.technicianName as string) || ""] },
              { text: [{ text: "Technician Signature: ", bold: true }, { text: (form.technicianSignature as string) || "", italics: true }] },
              { text: [{ text: "Date: ", bold: true }, (form.technicianDate as string) || ""] },
            ],
          ],
        },
        layout: "lightHorizontalLines",
      },

      // Footer note
      { text: "* The authorization of this Consent and Assignment of Benefits expires on the anniversary date of the Date of Service listed above.", style: "footerNote", marginTop: 6 },
    ],
    styles: {
      orgName: { fontSize: 18, bold: true, color: "#1a365d" },
      headerTitle: { fontSize: 10, color: "#1a365d" },
      legalHeading: { fontSize: 9, bold: true, decoration: "underline", marginTop: 5, marginBottom: 2 },
      legalText: { fontSize: 8, color: "#333", lineHeight: 1.3 },
      footerNote: { fontSize: 7, color: "#666", italics: true },
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
