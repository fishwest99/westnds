import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, useWindowDimensions, Pressable, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as MailComposer from "expo-mail-composer";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "@/lib/api/api";
import { downloadPdfToFile } from "@/lib/pdf/download-pdf";
import { SignaturePad } from "@/components/SignaturePad";
import { DatePickerInput } from "@/components/DatePickerInput";

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
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      saveForm(updated);
      return updated;
    });
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
    const uri = await downloadPdfToFile({
      url: `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/medical-lien-forms/${id}/pdf`,
      filename: `medical-lien-form-${id}.pdf`,
    });
    if (!uri) {
      Alert.alert("Error", "Failed to download PDF");
      return null;
    }
    return uri;
  };

  const handleEmailPdf = async () => {
    if (Platform.OS === "web") {
      setEmailLoading(true);
      try {
        await downloadPdf();
      } finally {
        setEmailLoading(false);
      }
      return;
    }
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
      if (Platform.OS === "web") return;
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
            <Text style={[styles.savingText, !saving && { opacity: 0 }]}>Saving...</Text>
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
                <DatePickerInput
                  value={form.dateOfAccident}
                  onChange={(v) => update("dateOfAccident", v)}
                  format="MM/DD/YYYY"
                  testID="date-of-accident-picker"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Date of Surgery</Text>
                <DatePickerInput
                  value={form.dateOfSurgery}
                  onChange={(v) => update("dateOfSurgery", v)}
                  format="MM/DD/YYYY"
                  testID="date-of-surgery-picker"
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
                {`This Medical Lien Agreement ("Agreement") is entered into by and between the undersigned patient ("Patient") and the medical provider(s) listed below, and is intended to create a binding lien on any settlement, judgment, or recovery arising from the Patient's personal injury claim.`}
              </Text>
            </View>

            <View style={styles.legalBlock}>
              <Text style={styles.legalHeader}>PARTIES</Text>
              <Text style={styles.legalBody}>
                {`This Agreement is made between:\n   Medical Provider(s):  WEST NDX - READING and/or WEST NDX - SERVICES\n   Attorney(s) Representing Patient / Case Manager`}
              </Text>
            </View>

            <View style={styles.legalBlock}>
              <Text style={styles.legalHeader}>AUTHORIZATION TO PAY PROVIDER</Text>
              <Text style={styles.legalBody}>
                {`The undersigned Patient hereby authorizes and irrevocably instructs their attorney(s) to pay directly to Provider any and all sums due for medical services rendered to the Patient from the proceeds of any settlement, judgment, or verdict obtained in connection with the personal injury claim arising from the incident described above.`}
              </Text>
            </View>

            <View style={styles.legalBlock}>
              <Text style={styles.legalHeader}>NOTICE OF LIEN</Text>
              <Text style={styles.legalBody}>
                {`This document shall serve as formal notice to the attorney(s) of the Provider's lien against any recovery obtained by or on behalf of the Patient. The lien is effective immediately upon the Provider's rendering of services, and shall remain valid and enforceable regardless of whether the attorney(s) execute this Agreement below.`}
              </Text>
            </View>

            <View style={styles.legalBlock}>
              <Text style={styles.legalHeader}>PATIENT'S PERSONAL LIABILITY</Text>
              <Text style={styles.legalBody}>
                {`The Patient acknowledges and agrees that they remain fully and personally responsible for all charges for medical services rendered by the Provider, regardless of the outcome of the personal injury claim. The Patient's obligation to pay is not contingent upon any recovery from an insurer, defendant, or third party.`}
              </Text>
            </View>

            <View style={[styles.legalBlock, { marginBottom: 0 }]}>
              <Text style={styles.legalHeader}>ATTORNEY'S ACKNOWLEDGMENT (Optional)</Text>
              <Text style={styles.legalBody}>
                {`The undersigned attorney acknowledges receipt of this lien and agrees to honor its terms to the extent allowed by law.`}
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
              <DatePickerInput
                value={form.patientDate}
                onChange={(v) => update("patientDate", v)}
                format="MM/DD/YYYY"
                testID="patient-date-picker"
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
              <DatePickerInput
                value={form.attorneyDate}
                onChange={(v) => update("attorneyDate", v)}
                format="MM/DD/YYYY"
                testID="attorney-date-picker"
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
