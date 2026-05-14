import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, useWindowDimensions, Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { File as FSFile, Paths } from "expo-file-system";
import * as MailComposer from "expo-mail-composer";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "@/lib/api/api";
import { SignaturePad } from "@/components/SignaturePad";
import { DatePickerInput } from "@/components/DatePickerInput";

type ConsentFormData = {
  id?: string;
  status: string;
  companyReading: boolean;
  companyServices: boolean;
  patientName: string;
  dateOfBirth: string;
  dateOfService: string;
  surgeonName: string;
  procedure: string;
  modalityABR: boolean;
  modalityTEMG: boolean;
  modalityEEG: boolean;
  modalityTO4NMJ: boolean;
  modalityEMG: boolean;
  modalityVEP: boolean;
  modalityNVC: boolean;
  modalitySSEP: boolean;
  modalityTcMEP: boolean;
  modalityOtherText: string;
  tcmepNone: boolean;
  tcmepSeizures: boolean;
  tcmepSkullDefects: boolean;
  tcmepDefibrillator: boolean;
  tcmepOtherText: string;
  tcmepImplants: boolean;
  tcmepSpinalCord: boolean;
  tcmepDBS: boolean;
  tcmepCochlearImpl: boolean;
  symptomAtaxia: boolean;
  symptomHeadaches: boolean;
  symptomPain: boolean;
  symptomVision: boolean;
  symptomBalance: boolean;
  symptomHearing: boolean;
  symptomParalysis: boolean;
  symptomVomiting: boolean;
  symptomBurning: boolean;
  symptomIncontinence: boolean;
  symptomSpasticity: boolean;
  symptomWeakness: boolean;
  symptomCognitive: boolean;
  symptomMemory: boolean;
  symptomSpeech: boolean;
  symptomNaseau: boolean;
  symptomStroke: boolean;
  symptomDizziness: boolean;
  symptomNumbness: boolean;
  symptomTingling: boolean;
  symptomOtherText: string;
  otherMedicalHistory: string;
  patientGuardianName: string;
  patientSignature: string;
  patientSignatureDate: string;
  technicianName: string;
  technicianSignature: string;
  technicianDate: string;
};

const defaultForm: ConsentFormData = {
  status: "draft",
  companyReading: false, companyServices: false,
  patientName: "", dateOfBirth: "", dateOfService: "", surgeonName: "", procedure: "",
  modalityABR: false, modalityTEMG: false, modalityEEG: false, modalityTO4NMJ: false,
  modalityEMG: false, modalityVEP: false, modalityNVC: false, modalitySSEP: false, modalityTcMEP: false,
  modalityOtherText: "",
  tcmepNone: false, tcmepSeizures: false, tcmepSkullDefects: false, tcmepDefibrillator: false,
  tcmepOtherText: "", tcmepImplants: false, tcmepSpinalCord: false, tcmepDBS: false, tcmepCochlearImpl: false,
  symptomAtaxia: false, symptomHeadaches: false, symptomPain: false, symptomVision: false,
  symptomBalance: false, symptomHearing: false, symptomParalysis: false, symptomVomiting: false,
  symptomBurning: false, symptomIncontinence: false, symptomSpasticity: false, symptomWeakness: false,
  symptomCognitive: false, symptomMemory: false, symptomSpeech: false, symptomNaseau: false,
  symptomStroke: false, symptomDizziness: false, symptomNumbness: false, symptomTingling: false,
  symptomOtherText: "",
  otherMedicalHistory: "", patientGuardianName: "", patientSignature: "", patientSignatureDate: "",
  technicianName: "", technicianSignature: "", technicianDate: "",
};

function Checkbox({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={() => onChange(!value)} activeOpacity={0.7}>
      <View style={[styles.checkBox, value && styles.checkBoxChecked]}>
        {value ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function EditConsentFormScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const checkCellWidth = isTablet ? "25%" : "50%";
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [form, setForm] = useState<ConsentFormData>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (id) loadForm(id);
  }, [id]);

  const loadForm = async (formId: string) => {
    try {
      const result = await api.get<ConsentFormData & { id: string }>(`/api/consent-forms/${formId}`);
      if (!result) {
        Alert.alert("Error", "Form not found.");
        router.back();
        return;
      }
      setForm({ ...defaultForm, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Error", `Failed to load form: ${msg}`);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const saveForm = useCallback((updatedForm: ConsentFormData) => {
    if (!id) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.put(`/api/consent-forms/${id}`, updatedForm);
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [id]);

  const update = (key: keyof ConsentFormData, value: string | boolean) => {
    const updated = { ...form, [key]: value };
    setForm(updated);
    saveForm(updated);
  };

  const handleSubmit = async () => {
    if (!id) return;
    if (!form.patientGuardianName.trim() || !form.patientSignature.trim()) {
      Alert.alert("Required", "Please provide patient/guardian name and signature before submitting.");
      return;
    }
    Alert.alert(
      "Submit Form",
      "By submitting, you confirm your consent to these procedures and acknowledge your benefits and financial responsibility.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.post(`/api/consent-forms/${id}/submit`, {});
              setForm((f) => ({ ...f, status: "submitted" }));
            } catch {
              Alert.alert("Error", "Failed to submit form.");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const downloadPdf = async (): Promise<string | null> => {
    if (!id) return null;
    const token = authClient.getCookie();
    const destination = new FSFile(Paths.cache, `consent-form-${id}.pdf`);
    try {
      const result = await FSFile.downloadFileAsync(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/consent-forms/${id}/pdf`,
        destination,
        { headers: { Cookie: token }, idempotent: true }
      );
      return result.uri;
    } catch {
      Alert.alert("Error", "Failed to download PDF");
      return null;
    }
  };

  const handleEmailPdf = async () => {
    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("Not Available", "Email is not available on this device. Try 'Share PDF' instead.");
      return;
    }
    setEmailLoading(true);
    try {
      const fileUri = await downloadPdf();
      if (!fileUri) return;
      await MailComposer.composeAsync({
        subject: `West NDx Consent Form - ${form.patientName || "Patient"}`,
        body: `Attached: completed consent form.\n\nPatient: ${form.patientName || ""}\nDate of Service: ${form.dateOfService || ""}\nSurgeon: ${form.surgeonName || ""}`,
        attachments: [fileUri],
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSharePdf = async () => {
    setShareLoading(true);
    try {
      const fileUri = await downloadPdf();
      if (!fileUri) return;
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Not Available", "Sharing is not available on this device.");
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Consent Form PDF",
        UTI: "com.adobe.pdf",
      });
    } finally {
      setShareLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2b6cb0" />
          <Text style={styles.loadingText}>Loading form...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSubmitted = form.status === "submitted";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="edit-consent-form-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{form.patientName || "Edit Case"}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}>
        <View style={[styles.inner, isTablet && styles.innerTablet]}>
          <View style={styles.formHeader}>
            <Text style={styles.orgName}>West NDx</Text>
            <Text style={styles.formTitle}>Informed Consent, Assignment of Benefits and Financial Responsibility</Text>
            <Text style={styles.formSubtitle}>Intraoperative Neuromonitoring Services</Text>
            {saving ? <Text style={styles.savingText}>Saving...</Text> : null}
            {isSubmitted ? (
              <View style={styles.submittedBadge}>
                <Text style={styles.submittedText}>✓ Submitted</Text>
              </View>
            ) : null}
          </View>

          {/* Company */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Company(ies) Providing IOM Services</Text>
            <Checkbox label="West NDS/NDR" value={form.companyReading} onChange={(v) => update("companyReading", v)} />
          </View>

          {/* Patient Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Patient Information</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Patient Name *</Text>
              <TextInput style={styles.input} value={form.patientName} onChangeText={(v) => update("patientName", v)} placeholder="Full patient name" testID="patient-name-input" />
            </View>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Date of Birth</Text>
                <DatePickerInput
                  value={form.dateOfBirth}
                  onChange={(v) => update("dateOfBirth", v)}
                  format="MM/DD/YYYY"
                  minDate="1930-01-01"
                  testID="date-of-birth-picker"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Date of Service *</Text>
                <DatePickerInput
                  value={form.dateOfService}
                  onChange={(v) => update("dateOfService", v)}
                  format="MM/DD/YYYY"
                  testID="date-of-service-picker"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Surgeon / Physician Name</Text>
              <TextInput style={styles.input} value={form.surgeonName} onChangeText={(v) => update("surgeonName", v)} placeholder="Physician name" />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Procedure</Text>
              <TextInput style={styles.input} value={form.procedure} onChangeText={(v) => update("procedure", v)} placeholder="Describe procedure" />
            </View>
          </View>

          {/* Modalities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Modalities</Text>
            <View style={styles.checkGrid}>
              {([
                ["modalityABR", "ABR"], ["modalityTEMG", "T-EMG"], ["modalityEEG", "EEG"],
                ["modalityTO4NMJ", "TO4 (NMJ)"], ["modalityEMG", "EMG"], ["modalityVEP", "VEP"],
                ["modalityNVC", "NVC"], ["modalitySSEP", "SSEP"], ["modalityTcMEP", "TcMEP"],
              ] as [keyof ConsentFormData, string][]).map(([key, label]) => (
                <View key={key} style={[styles.checkCell, { width: checkCellWidth }]}>
                  <Checkbox label={label} value={form[key] as boolean} onChange={(v) => update(key, v)} />
                </View>
              ))}
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Other Modality</Text>
              <TextInput style={styles.input} value={form.modalityOtherText} onChangeText={(v) => update("modalityOtherText", v)} placeholder="Specify other modality" />
            </View>
          </View>

          {/* TcMEP Concerns */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TcMEP Concerns</Text>
            <View style={styles.checkGrid}>
              {([
                ["tcmepNone", "None"], ["tcmepSeizures", "Seizures"],
                ["tcmepSkullDefects", "Skull Defects / Plating"], ["tcmepDefibrillator", "Defibrillator"],
                ["tcmepImplants", "Implants"], ["tcmepSpinalCord", "Spinal Cord Stimulator"],
                ["tcmepDBS", "DBS"], ["tcmepCochlearImpl", "Cochlear Implant"],
              ] as [keyof ConsentFormData, string][]).map(([key, label]) => (
                <View key={key} style={[styles.checkCell, { width: checkCellWidth }]}>
                  <Checkbox label={label} value={form[key] as boolean} onChange={(v) => update(key, v)} />
                </View>
              ))}
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Other</Text>
              <TextInput style={styles.input} value={form.tcmepOtherText} onChangeText={(v) => update("tcmepOtherText", v)} placeholder="Specify other concern" />
            </View>
          </View>

          {/* Symptoms */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Symptoms</Text>
            <View style={styles.checkGrid}>
              {([
                ["symptomAtaxia", "Ataxia"], ["symptomHeadaches", "Headaches"],
                ["symptomPain", "Pain"], ["symptomVision", "Vision"],
                ["symptomBalance", "Balance"], ["symptomHearing", "Hearing"],
                ["symptomParalysis", "Paralysis"], ["symptomVomiting", "Vomiting"],
                ["symptomBurning", "Burning"], ["symptomIncontinence", "Incontinence"],
                ["symptomSpasticity", "Spasticity"], ["symptomWeakness", "Weakness"],
                ["symptomCognitive", "Cognitive Dysfunction"], ["symptomMemory", "Memory"],
                ["symptomSpeech", "Speech"], ["symptomNaseau", "Naseau"],
                ["symptomStroke", "Stroke"], ["symptomDizziness", "Dizziness"],
                ["symptomNumbness", "Numbness"], ["symptomTingling", "Tingling"],
              ] as [keyof ConsentFormData, string][]).map(([key, label]) => (
                <View key={key} style={[styles.checkCell, { width: checkCellWidth }]}>
                  <Checkbox label={label} value={form[key] as boolean} onChange={(v) => update(key, v)} />
                </View>
              ))}
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Other</Text>
              <TextInput
                style={styles.input}
                value={form.symptomOtherText}
                onChangeText={(v) => update("symptomOtherText", v)}
                placeholder="Describe any other symptoms..."
                testID="symptom-other-input"
              />
            </View>
          </View>

          {/* Other Medical History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Other Pertinent Medical History</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.otherMedicalHistory}
              onChangeText={(v) => update("otherMedicalHistory", v)}
              placeholder="Enter any other relevant medical history..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Legal Text */}
          <View style={styles.section}>
            <Text style={styles.legalHeading}>Informed Consent</Text>
            <Text style={styles.legalText}>I hereby authorize West Neurodigmostics-Reading, LLC and West Neurodigmostics-Services, LLC - (West NDx), Out-Of-Network provider(s) to perform Intraoperative Neurophysiologic Monitoring as requested by my surgeon. Testing modalities may include, but are not limited to Transcranial Motor Evoked Potentials (TcMEP), Somatosensory Evoked Potentials (SSEP), Brainstem Auditory Evoked Potentials (BAEP), Electroencephalography (EEG) and Electromyography (EMG). I authorize West NDx to share the data obtained during the monitoring with a Physician, either, in person or via secure internet transmission, for the purpose of interpreting the data. I understand that I have the right to informed consent, to which my surgeon, authorized representative, or Technologist will explain the monitoring process and answer questions I may have in regard to the performed services.</Text>
            <Text style={styles.legalHeading}>Assignment of Rights and Benefits</Text>
            <Text style={styles.legalText}>In consideration of the medical services to be provided, I understand that I am responsible for payment for these services in accordance with the rates and terms now in effect at West NDx to the extent that I am legally responsible. I hereby assign West NDx, Physician, or affiliated third-party company (together known as {'"'}West NDx and affiliates{'"'}), any and all benefits and all interest and rights (including the right to collect the unpaid insurance benefits, penalties, attorney{`'`}s fees, court costs and all recoverable damages of any nature from the medical insurance company that provided coverage on the date listed herein), for services rendered under any insurance policy or prepaid healthcare plan. This assignment includes the right to appeal with the payer and/or bring litigation to the insured{`'`}s medical insurance company in the insured{`'`}s name and assert all claims that the insured will have against the insurance company resulting from, or in any way pertaining to, the medical coverage that the insured is alleged to have had with his/her insurance company in regard to aforementioned medical procedures to be performed. The insured agrees to cooperate with West NDx and affiliates in providing documents and testimony concerning the rights assigned herein. I acknowledge that any {'"'}Patient Responsibility{'"'}, including but not limited to Co-Insurance, Out-Of-Pocket, Deductible, etc, that is not covered or paid by such policy, or plan not covered by Medicare or Workers{`'`} Compensation, is my legal responsibility. I authorize the release of information to the Social Security Administration or its intermediaries or carriers as well as any information needed for billing Medicare/Medicaid claims. I request that payment and authorized benefits be made on my behalf and I assign benefits payable for services rendered by West NDx and affiliates.</Text>
            <Text style={styles.legalHeading}>Authorization to Release Information and Appointed Representative</Text>
            <Text style={styles.legalText}>I authorize West NDx and affiliates to have full and complete access to my hospital medical records. Furthermore, I authorize West NDx and affiliates to furnish requested information from my medical and other records to any insurance or third-party payer, or to any other persons or entities financially responsible for the patient{`'`}s care or treatment, including representatives of local, state or federal agencies in accordance with applicable law, for the purpose of obtaining payment on the account. I authorize West NDx to release information or copies of these records to any referring physician, neurologist, affiliated third-party company or healthcare facility as necessary. I authorize West NDx to act as my duly appointed representative in the resolution of any unpaid charges; including, acting on my behalf during any reconsideration/appeal; in that regard, I acknowledge I have the right to revoke my designation of West NDx as my appointed representative via written revocation to West NDx. I acknowledge West NDx{`'`}s authority to continue to act as my appointed representative will continue until West NDx receives my written revocation.</Text>
            <Text style={styles.legalHeading}>Surprise/Balance Billing Disclosure</Text>
            <Text style={styles.legalText}>I have been made aware that West NDx are out-of-network providers prior to this procedure. I have also been made aware I have the right to request an in-network provider to perform all my covered medical services. If an in-network provider is not available, I may receive these services from an out-of-network provider. I understand if this is the case, the most I can be billed for covered services is my in-network cost-sharing amount, which are copayments, deductibles, and/or coinsurance. West NDx will not bill me for additional costs.</Text>
            <Text style={styles.legalHeading}>Financial Responsibility</Text>
            <Text style={styles.legalText}>I hereby authorize West NDx to pursue payment for the IOM services performed on the procedure on this date. I give this authority from the actions they require as defined above.</Text>
            <Text style={styles.legalText}>My signature below indicates that I consent to these procedures and have been made aware of my benefits and financial responsibility.</Text>
          </View>

          {/* Signatures */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Signatures</Text>
            <Text style={styles.signatureNote}>* The authorization of this Consent expires on the anniversary date of the Date of Service listed above.</Text>

            <Text style={styles.sigGroupLabel}>Patient / Legal Guardian</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Printed Full Name *</Text>
              <TextInput style={styles.input} value={form.patientGuardianName} onChangeText={(v) => update("patientGuardianName", v)} placeholder="Print full name" testID="guardian-name-input" />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Signature *</Text>
              <SignaturePad value={form.patientSignature} onChange={(v) => update("patientSignature", v)} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date</Text>
              <DatePickerInput
                value={form.patientSignatureDate}
                onChange={(v) => update("patientSignatureDate", v)}
                format="MM/DD/YYYY"
                testID="patient-signature-date-picker"
              />
            </View>

            <View style={styles.divider} />

            <Text style={styles.sigGroupLabel}>Technician</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Printed Full Name</Text>
              <TextInput style={styles.input} value={form.technicianName} onChangeText={(v) => update("technicianName", v)} placeholder="Technician full name" />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Technician Signature</Text>
              <SignaturePad value={form.technicianSignature} onChange={(v) => update("technicianSignature", v)} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date</Text>
              <DatePickerInput
                value={form.technicianDate}
                onChange={(v) => update("technicianDate", v)}
                format="MM/DD/YYYY"
                testID="technician-date-picker"
              />
            </View>
          </View>

          {isSubmitted ? (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionButton, styles.emailButton]} onPress={handleEmailPdf} disabled={emailLoading} testID="email-pdf-button">
                {emailLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionButtonText}>Email PDF</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.shareButton]} onPress={handleSharePdf} disabled={shareLoading} testID="share-pdf-button">
                {shareLoading ? <ActivityIndicator color="#2b6cb0" size="small" /> : <Text style={[styles.actionButtonText, { color: "#2b6cb0" }]}>Share PDF</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting} testID="submit-button">
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Consent Form</Text>}
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a365d" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a365d",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { paddingRight: 12 },
  backText: { color: "#90cdf4", fontSize: 15, fontWeight: "600" },
  headerTitle: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  content: { padding: 16 },
  contentTablet: { alignItems: "center" },
  inner: { width: "100%" },
  innerTablet: { maxWidth: 800, width: "100%" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f0f4f8" },
  loadingText: { marginTop: 12, color: "#4a5568", fontSize: 16 },
  formHeader: { backgroundColor: "#1a365d", borderRadius: 12, padding: 20, marginBottom: 16 },
  orgName: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 8 },
  formTitle: { fontSize: 15, fontWeight: "700", color: "#bee3f8", lineHeight: 22 },
  formSubtitle: { fontSize: 13, color: "#90cdf4", marginTop: 4 },
  savingText: { fontSize: 12, color: "#90cdf4", marginTop: 6 },
  submittedBadge: { marginTop: 8, backgroundColor: "#276749", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, alignSelf: "flex-start" },
  submittedText: { color: "#c6f6d5", fontSize: 13, fontWeight: "700" },
  section: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1a365d", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 8 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#4a5568", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: "#f8fafc", color: "#1a202c" },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap" },
  halfCell: { width: "50%" },
  checkGrid: { flexDirection: "row", flexWrap: "wrap" },
  checkCell: { width: "50%", marginBottom: 4 },
  checkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  checkBox: { width: 20, height: 20, borderWidth: 2, borderColor: "#cbd5e0", borderRadius: 4, justifyContent: "center", alignItems: "center", marginRight: 8, backgroundColor: "#fff" },
  checkBoxChecked: { backgroundColor: "#2b6cb0", borderColor: "#2b6cb0" },
  checkMark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  checkLabel: { fontSize: 13, color: "#2d3748", flex: 1 },
  legalHeading: { fontSize: 13, fontWeight: "700", color: "#1a365d", marginTop: 12, marginBottom: 4, textDecorationLine: "underline" },
  legalText: { fontSize: 12, color: "#4a5568", lineHeight: 18 },
  signatureNote: { fontSize: 12, color: "#718096", fontStyle: "italic", marginBottom: 12, lineHeight: 18 },
  sigGroupLabel: { fontSize: 13, fontWeight: "700", color: "#2b6cb0", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10, marginTop: 4 },
  divider: { borderTopWidth: 1, borderTopColor: "#e2e8f0", marginVertical: 16 },
  submitButton: { backgroundColor: "#276749", borderRadius: 12, padding: 18, alignItems: "center", marginTop: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  actionButton: { flex: 1, borderRadius: 12, padding: 16, alignItems: "center", justifyContent: "center" },
  emailButton: { backgroundColor: "#276749" },
  shareButton: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#2b6cb0" },
  actionButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
