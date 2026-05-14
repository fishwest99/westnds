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

type MedicalLienFormData = {
  id?: string;
  status: string;
  patientName: string;
  dateOfAccident: string;
  dateOfSurgery: string;
  iomCharges: string;
  patientSignature: string;
  patientRepName: string;
  patientDate: string;
  attorneySignature: string;
  attorneyName: string;
  attorneyDate: string;
};

const defaultForm: MedicalLienFormData = {
  status: "draft",
  patientName: "",
  dateOfAccident: "",
  dateOfSurgery: "",
  iomCharges: "",
  patientSignature: "",
  patientRepName: "",
  patientDate: "",
  attorneySignature: "",
  attorneyName: "",
  attorneyDate: "",
};

export default function EditMedicalLienFormScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [form, setForm] = useState<MedicalLienFormData>(defaultForm);
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
      const result = await api.get<MedicalLienFormData & { id: string }>(`/api/medical-lien-forms/${formId}`);
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

  const saveForm = useCallback((updatedForm: MedicalLienFormData) => {
    if (!id) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.put(`/api/medical-lien-forms/${id}`, updatedForm);
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [id]);

  const update = (key: keyof MedicalLienFormData, value: string) => {
    const updated = { ...form, [key]: value };
    setForm(updated);
    saveForm(updated);
  };

  const handleSubmit = async () => {
    if (!id) return;
    if (!form.patientName.trim() || !form.patientSignature.trim()) {
      Alert.alert("Required", "Please provide patient name and patient signature before submitting.");
      return;
    }
    Alert.alert(
      "Submit Medical Lien Agreement",
      "Are you sure you want to submit this Medical Lien Agreement?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.post(`/api/medical-lien-forms/${id}/submit`, {});
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
    const destination = new FSFile(Paths.cache, `medical-lien-form-${id}.pdf`);
    try {
      const result = await FSFile.downloadFileAsync(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/medical-lien-forms/${id}/pdf`,
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
        subject: `West NDx Medical Lien Agreement - ${form.patientName || "Patient"}`,
        body: `Attached: completed Medical Lien Agreement.\n\nPatient: ${form.patientName || ""}\nDate of Accident: ${form.dateOfAccident || ""}\nDate of Surgery: ${form.dateOfSurgery || ""}`,
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
        dialogTitle: "Share Medical Lien Agreement PDF",
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
    <SafeAreaView style={styles.safe} edges={["top"]} testID="edit-medical-lien-form-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{form.patientName || "Medical Lien Agreement"}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}>
        <View style={[styles.inner, isTablet && styles.innerTablet]}>

          {/* Form Header */}
          <View style={styles.formHeader}>
            <Text style={styles.orgName}>West NDx</Text>
            <Text style={styles.formTitle}>Medical Lien Agreement</Text>
            <Text style={styles.formSubtitle}>Personal Injury Lien for Medical Services</Text>
            {saving ? <Text style={styles.savingText}>Saving...</Text> : null}
            {isSubmitted ? (
              <View style={styles.submittedBadge}>
                <Text style={styles.submittedText}>✓ Submitted</Text>
              </View>
            ) : null}
          </View>

          {/* Section 1: Patient Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Patient Information</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Patient Printed Name *</Text>
              <TextInput
                style={styles.input}
                value={form.patientName}
                onChangeText={(v) => update("patientName", v)}
                placeholder="Full patient name"
                testID="patient-name-input"
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Date of Accident / Injury</Text>
                <TextInput
                  style={styles.input}
                  value={form.dateOfAccident}
                  onChangeText={(v) => update("dateOfAccident", v)}
                  placeholder="MM/DD/YYYY"
                  testID="date-of-accident-input"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Date of Surgery</Text>
                <TextInput
                  style={styles.input}
                  value={form.dateOfSurgery}
                  onChangeText={(v) => update("dateOfSurgery", v)}
                  placeholder="MM/DD/YYYY"
                  testID="date-of-surgery-input"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>IOM Charges</Text>
              <TextInput
                style={styles.input}
                value={form.iomCharges}
                onChangeText={(v) => update("iomCharges", v)}
                placeholder="e.g. $0.00"
                testID="iom-charges-input"
              />
            </View>
          </View>

          {/* Section 2: Legal Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal Summary</Text>

            <View style={styles.legalBlock}>
              <Text style={styles.legalBody}>
                This Medical Lien Agreement is entered into by and between the undersigned patient and the medical provider(s) listed below, and is intended to create a binding lien on any settlement, judgment, or recovery arising from the Patient's personal injury claim.
              </Text>
            </View>

            <View style={styles.legalBlock}>
              <Text style={styles.legalHeader}>PARTIES</Text>
              <Text style={styles.legalBody}>
                Medical Provider(s): WEST NDX - READING and/or WEST NDX - SERVICES
              </Text>
            </View>

            <View style={styles.legalBlock}>
              <Text style={styles.legalHeader}>AUTHORIZATION TO PAY PROVIDER</Text>
              <Text style={styles.legalBody}>
                The Patient hereby authorizes and directs any attorney, insurance company, or other party holding funds from the Patient's personal injury claim to pay directly to the medical provider(s) the amount due for services rendered, from the Patient's share of any settlement, judgment, or insurance proceeds.
              </Text>
            </View>

            <View style={styles.legalBlock}>
              <Text style={styles.legalHeader}>NOTICE OF LIEN</Text>
              <Text style={styles.legalBody}>
                This agreement constitutes a valid and enforceable lien against any funds recovered by the Patient through settlement, litigation, or otherwise in connection with the personal injury claim. The lien shall remain in effect until all charges for services rendered are paid in full.
              </Text>
            </View>

            <View style={styles.legalBlock}>
              <Text style={styles.legalHeader}>PATIENT'S PERSONAL LIABILITY</Text>
              <Text style={styles.legalBody}>
                The Patient acknowledges personal liability for all charges incurred. If no recovery is obtained, or if the recovery is insufficient to cover all charges, the Patient remains personally responsible for payment of the balance due.
              </Text>
            </View>

            <View style={[styles.legalBlock, { marginBottom: 0 }]}>
              <Text style={styles.legalHeader}>ATTORNEY'S ACKNOWLEDGMENT (Optional)</Text>
              <Text style={styles.legalBody}>
                By signing below, the Patient's attorney acknowledges notice of this lien and agrees to honor it from any funds held on behalf of the Patient, and to notify the medical provider prior to disbursing any settlement or judgment proceeds.
              </Text>
            </View>
          </View>

          {/* Section 3: Patient Signature */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Patient Signature</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Patient / Authorized Rep Signature *</Text>
              <SignaturePad
                value={form.patientSignature}
                onChange={(v) => update("patientSignature", v)}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Patient / Authorized Rep Name</Text>
              <TextInput
                style={styles.input}
                value={form.patientRepName}
                onChangeText={(v) => update("patientRepName", v)}
                placeholder="Printed name"
                testID="patient-rep-name-input"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={form.patientDate}
                onChangeText={(v) => update("patientDate", v)}
                placeholder="MM/DD/YYYY"
                testID="patient-date-input"
              />
            </View>
          </View>

          {/* Section 4: Attorney Signature (Optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attorney Signature (Optional)</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Patient's Attorney Signature</Text>
              <SignaturePad
                value={form.attorneySignature}
                onChange={(v) => update("attorneySignature", v)}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Patient's Attorney Name</Text>
              <TextInput
                style={styles.input}
                value={form.attorneyName}
                onChangeText={(v) => update("attorneyName", v)}
                placeholder="Attorney printed name"
                testID="attorney-name-input"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={form.attorneyDate}
                onChangeText={(v) => update("attorneyDate", v)}
                placeholder="MM/DD/YYYY"
                testID="attorney-date-input"
              />
            </View>
          </View>

          {isSubmitted ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.emailButton]}
                onPress={handleEmailPdf}
                disabled={emailLoading}
                testID="email-pdf-button"
              >
                {emailLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.actionButtonText}>Email PDF</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.shareButton]}
                onPress={handleSharePdf}
                disabled={shareLoading}
                testID="share-pdf-button"
              >
                {shareLoading
                  ? <ActivityIndicator color="#2b6cb0" size="small" />
                  : <Text style={[styles.actionButtonText, { color: "#2b6cb0" }]}>Share PDF</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}
              testID="submit-button"
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>Submit Medical Lien Agreement</Text>}
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
  row: { flexDirection: "row", flexWrap: "wrap" },
  legalBlock: { backgroundColor: "#f7fafc", borderRadius: 8, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: "#c05621" },
  legalHeader: { fontSize: 12, fontWeight: "700", color: "#c05621", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  legalBody: { fontSize: 13, color: "#4a5568", lineHeight: 20 },
  submitButton: { backgroundColor: "#c05621", borderRadius: 12, padding: 18, alignItems: "center", marginTop: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  actionButton: { flex: 1, borderRadius: 12, padding: 16, alignItems: "center", justifyContent: "center" },
  emailButton: { backgroundColor: "#c05621" },
  shareButton: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#2b6cb0" },
  actionButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
