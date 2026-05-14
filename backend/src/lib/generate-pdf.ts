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
              form.modalityOtherText ? { text: `${check(true)} Other: ${form.modalityOtherText as string}` } : { text: `${check(false)} Other` },
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
      { text: "I hereby authorize West Neurodigmostics-Reading, LLC and West Neurodigmostics-Services, LLC - (West NDx), Out-Of-Network provider(s) to perform Intraoperative Neurophysiologic Monitoring as requested by my surgeon. Testing modalities may include, but are not limited to Transcranial Motor Evoked Potentials (TcMEP), Somatosensory Evoked Potentials (SSEP), Brainstem Auditory Evoked Potentials (BAEP), Electroencephalography (EEG) and Electromyography (EMG). I authorize West NDx to share the data obtained during the monitoring with a Physician, either, in person or via secure internet transmission, for the purpose of interpreting the data. I understand that I have the right to informed consent, to which my surgeon, authorized representative, or Technologist will explain the monitoring process and answer questions I may have in regard to the performed services.", style: "legalText" },

      { text: "Assignment of Rights and Benefits", style: "legalHeading" },
      { text: "In consideration of the medical services to be provided, I understand that I am responsible for payment for these services in accordance with the rates and terms now in effect at West NDx to the extent that I am legally responsible. I hereby assign West NDx, Physician, or affiliated third-party company (together known as \"West NDx and affiliates\"), any and all benefits and all interest and rights (including the right to collect the unpaid insurance benefits, penalties, attorney's fees, court costs and all recoverable damages of any nature from the medical insurance company that provided coverage on the date listed herein), for services rendered under any insurance policy or prepaid healthcare plan. This assignment includes the right to appeal with the payer and/or bring litigation to the insured's medical insurance company in the insured's name and assert all claims that the insured will have against the insurance company resulting from, or in any way pertaining to, the medical coverage that the insured is alleged to have had with his/her insurance company in regard to aforementioned medical procedures to be performed. The insured agrees to cooperate with West NDx and affiliates in providing documents and testimony concerning the rights assigned herein. I acknowledge that any \"Patient Responsibility\", including but not limited to Co-Insurance, Out-Of-Pocket, Deductible, etc, that is not covered or paid by such policy, or plan not covered by Medicare or Workers' Compensation, is my legal responsibility. I authorize the release of information to the Social Security Administration or its intermediaries or carriers as well as any information needed for billing Medicare/Medicaid claims. I request that payment and authorized benefits be made on my behalf and I assign benefits payable for services rendered by West NDx and affiliates.", style: "legalText" },

      { text: "Authorization to Release Information and Appointed Representative", style: "legalHeading" },
      { text: "I authorize West NDx and affiliates to have full and complete access to my hospital medical records. Furthermore, I authorize West NDx and affiliates to furnish requested information from my medical and other records to any insurance or third-party payer, or to any other persons or entities financially responsible for the patient's care or treatment, including representatives of local, state or federal agencies in accordance with applicable law, for the purpose of obtaining payment on the account. I authorize West NDx to release information or copies of these records to any referring physician, neurologist, affiliated third-party company or healthcare facility as necessary. I authorize West NDx to act as my duly appointed representative in the resolution of any unpaid charges; including, acting on my behalf during any reconsideration/appeal; in that regard, I acknowledge I have the right to revoke my designation of West NDx as my appointed representative via written revocation to West NDx. I acknowledge West NDx's authority to continue to act as my appointed representative will continue until West NDx receives my written revocation.", style: "legalText" },

      { text: "Surprise/Balance Billing Disclosure", style: "legalHeading" },
      { text: "I have been made aware that West NDx are out-of-network providers prior to this procedure. I have also been made aware I have the right to request an in-network provider to perform all my covered medical services. If an in-network provider is not available, I may receive these services from an out-of-network provider. I understand if this is the case, the most I can be billed for covered services is my in-network cost-sharing amount, which are copayments, deductibles, and/or coinsurance. West NDx will not bill me for additional costs.", style: "legalText" },

      { text: "Financial Responsibility", style: "legalHeading" },
      { text: "I hereby authorize West NDx to pursue payment for the IOM services performed on the procedure on this date. I give this authority from the actions they require as defined above.", style: "legalText" },

      { text: " ", marginBottom: 4 },

      // Signature section
      {
        table: {
          widths: ["*", "*", 80],
          body: [
            [
              { text: [{ text: "Patient or Legal Guardian Name (Print): ", bold: true }, (form.patientGuardianName as string) || ""] },
              (form.patientSignature as string)?.startsWith("data:image")
                ? { stack: [{ text: "Signature:", bold: true, marginBottom: 2 }, { image: form.patientSignature as string, width: 140, height: 50 }] }
                : { text: [{ text: "Signature: ", bold: true }, "___________________"] },
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
              (form.technicianSignature as string)?.startsWith("data:image")
                ? { stack: [{ text: "Technician Signature:", bold: true, marginBottom: 2 }, { image: form.technicianSignature as string, width: 140, height: 50 }] }
                : { text: [{ text: "Technician Signature: ", bold: true }, "___________________"] },
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
