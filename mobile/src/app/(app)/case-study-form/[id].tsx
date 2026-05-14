import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Pressable,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as MailComposer from "expo-mail-composer";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "@/lib/api/api";
import { downloadPdfToFile } from "@/lib/pdf/download-pdf";
import { SignaturePad } from "@/components/SignaturePad";
import { DatePickerInput } from "@/components/DatePickerInput";

type CaseStudyFormData = {
  id?: string;
  status: string;
  patientName: string;
  date: string;
  technicianName: string;
  craniotomyDiagnosis: string;
  selectedProcedures: string[];
  procedureOther: string;
  electrodePickupSites: string[];
  electrodeOther: string;
  selectedEPNerves: string[];
  selectedEMGMuscles: string[];
  problemsOrSignalLoss: string;
  diabetic: boolean;
  patientHistory: string;
  technicianSignature: string;
};

const defaultForm: CaseStudyFormData = {
  status: "draft",
  patientName: "",
  date: "",
  technicianName: "",
  craniotomyDiagnosis: "",
  selectedProcedures: [],
  procedureOther: "",
  electrodePickupSites: [],
  electrodeOther: "",
  selectedEPNerves: [],
  selectedEMGMuscles: [],
  problemsOrSignalLoss: "",
  diabetic: false,
  patientHistory: "",
  technicianSignature: "",
};

const PROCEDURE_GROUPS = [
  {
    label: "Cervical",
    items: ["ACDF", "Posterior Cervical", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"],
  },
  {
    label: "Lumbar / Other",
    items: ["Lumbar Laminectomy", "Microdiscectomy", "Fusion", "ALIF", "XLIF", "TLIF", "Hardware Removal"],
  },
  {
    label: "Thoracic",
    items: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"],
  },
  {
    label: "Lumbar",
    items: ["L1", "L2", "L3", "L4", "L5", "S1"],
  },
  {
    label: "Cranial Nerve",
    items: ["Thyroidectomy", "Parathyroidectomy", "Tympanoplasty", "Parotidectomy"],
  },
];

const ELECTRODE_SITES = ["CPZ", "FPZ", "C1", "C2", "CP3", "CP4", "C5", "A1", "A2"];

const EP_NERVES = [
  "Median", "Ulnar", "Radial", "C5", "C6", "C7", "C8",
  "Erbs", "Posterior Tibial", "Peroneal",
  "L2", "L3", "L4", "L5", "S1", "Saphenous", "Pop Fossa",
];

const EMG_MUSCLES = [
  "Trapezius", "Deltoids", "Biceps", "Triceps", "Abductor Pollicis",
  "Vast. Medialis", "EHL", "Anterior Tibialis", "Medial Gastrocs",
  "Upper MEPs", "Lower MEPs",
  "ABR Right", "ABR Left",
  "VER Right", "VER Left",
];

function ToggleChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : styles.chipTextUnselected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Checkbox({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      style={styles.checkRow}
      onPress={() => onChange(!value)}
      activeOpacity={0.7}
      testID={testID}
    >
      <View style={[styles.checkBox, value && styles.checkBoxChecked]}>
        {value ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CaseStudyFormScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [form, setForm] = useState<CaseStudyFormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isLoading } = useQuery({
    queryKey: ["case-study-form", id],
    queryFn: async () => {
      const result = await api.get<CaseStudyFormData & { id: string }>(`/api/case-study-forms/${id}`);
      if (!result || !result.id) {
        throw new Error("Could not load form.");
      }
      setForm({
        ...defaultForm,
        ...result,
        selectedProcedures: JSON.parse((result.selectedProcedures as unknown as string) || "[]"),
        electrodePickupSites: JSON.parse((result.electrodePickupSites as unknown as string) || "[]"),
        selectedEPNerves: JSON.parse((result.selectedEPNerves as unknown as string) || "[]"),
        selectedEMGMuscles: JSON.parse((result.selectedEMGMuscles as unknown as string) || "[]"),
      });
      return result;
    },
    enabled: !!id,
  });

  const saveForm = useCallback(
    (updatedForm: CaseStudyFormData) => {
      if (!id) return;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        setSaving(true);
        try {
          await api.put(`/api/case-study-forms/${id}`, {
            ...updatedForm,
            selectedProcedures: JSON.stringify(updatedForm.selectedProcedures),
            electrodePickupSites: JSON.stringify(updatedForm.electrodePickupSites),
            selectedEPNerves: JSON.stringify(updatedForm.selectedEPNerves),
            selectedEMGMuscles: JSON.stringify(updatedForm.selectedEMGMuscles),
          });
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [id]
  );

  const update = (key: keyof CaseStudyFormData, value: string | boolean | string[]) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      saveForm(updated);
      return updated;
    });
  };

  const toggleItem = (key: "selectedProcedures" | "electrodePickupSites" | "selectedEPNerves" | "selectedEMGMuscles", item: string) => {
    const current = form[key] as string[];
    const next = current.includes(item) ? current.filter((i) => i !== item) : [...current, item];
    update(key, next);
  };

  const handleSubmit = async () => {
    if (!id) return;
    if (!form.patientName.trim() || !form.technicianSignature.trim()) {
      Alert.alert("Required", "Please provide patient name and technician signature before submitting.");
      return;
    }
    Alert.alert(
      "Submit Case Study Checklist",
      "Are you sure you want to submit this form?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.post(`/api/case-study-forms/${id}/submit`, {});
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
      url: `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/case-study-forms/${id}/pdf`,
      filename: `case-study-form-${id}.pdf`,
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
        subject: `Case Study Checklist - ${form.patientName || "Patient"}`,
        body: `Please find attached the completed case study checklist.\n\nPatient: ${form.patientName || ""}\nDate: ${form.date || ""}\nTechnician: ${form.technicianName || ""}`,
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
        dialogTitle: "Share Case Study Checklist PDF",
        UTI: "com.adobe.pdf",
      });
    } finally {
      setShareLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
            <Text style={styles.backText}>← Case</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Case Study Checklist</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6b21a8" />
          <Text style={styles.loadingText}>Loading form...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSubmitted = form.status === "submitted";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="case-study-form-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Case</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Case Study Checklist</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
      >
        <View style={[styles.inner, isTablet && styles.innerTablet]}>

          {/* Form Header */}
          <View style={styles.formHeader}>
            <Text style={styles.orgName}>West NDx</Text>
            <Text style={styles.formTitle}>History of Electrodes and Muscles</Text>
            <Text style={styles.formSubtitle}>Intraoperative Monitoring Checklist</Text>
            {saving ? <Text style={styles.savingText}>Saving...</Text> : null}
            {isSubmitted ? (
              <View style={styles.submittedBadge}>
                <Text style={styles.submittedText}>✓ Submitted</Text>
              </View>
            ) : null}
          </View>

          {/* Patient Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Patient Info</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Patient Name *</Text>
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
                <Text style={styles.fieldLabel}>Date</Text>
                <DatePickerInput
                  value={form.date}
                  onChange={(v) => update("date", v)}
                  format="MM/DD/YYYY"
                  testID="date-picker"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Technician Name</Text>
                <TextInput
                  style={styles.input}
                  value={form.technicianName}
                  onChangeText={(v) => update("technicianName", v)}
                  placeholder="Technician name"
                  testID="technician-name-input"
                />
              </View>
            </View>
          </View>

          {/* Craniotomy Diagnosis */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Craniotomy Diagnosis</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Diagnosis</Text>
              <TextInput
                style={styles.input}
                value={form.craniotomyDiagnosis}
                onChangeText={(v) => update("craniotomyDiagnosis", v)}
                placeholder="Enter diagnosis"
                testID="craniotomy-diagnosis-input"
              />
            </View>
          </View>

          {/* Procedures */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Procedures</Text>
            {PROCEDURE_GROUPS.map((group) => (
              <View key={group.label} style={styles.chipGroup}>
                <Text style={styles.chipGroupLabel}>{group.label}</Text>
                <View style={styles.chipRow}>
                  {group.items.map((item) => (
                    <ToggleChip
                      key={item}
                      label={item}
                      selected={form.selectedProcedures.includes(item)}
                      onPress={() => toggleItem("selectedProcedures", item)}
                      testID={`procedure-chip-${item.replace(/\s+/g, "-").toLowerCase()}`}
                    />
                  ))}
                </View>
              </View>
            ))}
            <View style={[styles.field, { marginTop: 8 }]}>
              <Text style={styles.chipGroupLabel}>Other (not listed)</Text>
              <TextInput
                style={styles.input}
                value={form.procedureOther}
                onChangeText={(v) => update("procedureOther", v)}
                placeholder="Enter procedure if not listed above"
                testID="procedure-other-input"
              />
            </View>
          </View>

          {/* Electrode Pickup Sites */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Electrode Pickup Sites</Text>
            <View style={styles.chipRow}>
              {ELECTRODE_SITES.map((site) => (
                <ToggleChip
                  key={site}
                  label={site}
                  selected={form.electrodePickupSites.includes(site)}
                  onPress={() => toggleItem("electrodePickupSites", site)}
                  testID={`electrode-site-chip-${site.replace(/\s+/g, "-").toLowerCase()}`}
                />
              ))}
            </View>
            <View style={[styles.field, { marginTop: 12 }]}>
              <Text style={styles.fieldLabel}>Other</Text>
              <TextInput
                style={styles.input}
                value={form.electrodeOther}
                onChangeText={(v) => update("electrodeOther", v)}
                placeholder="Other electrode sites"
                testID="electrode-other-input"
              />
            </View>
          </View>

          {/* Evoked Potential Nerves */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Evoked Potential Nerves Used</Text>
            <View style={styles.chipRow}>
              {EP_NERVES.map((nerve) => (
                <ToggleChip
                  key={nerve}
                  label={nerve}
                  selected={form.selectedEPNerves.includes(nerve)}
                  onPress={() => toggleItem("selectedEPNerves", nerve)}
                  testID={`ep-nerve-chip-${nerve.replace(/\s+/g, "-").toLowerCase()}`}
                />
              ))}
            </View>
          </View>

          {/* EMG Muscles */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EMG Muscles Used</Text>
            <View style={styles.chipRow}>
              {EMG_MUSCLES.map((muscle) => (
                <ToggleChip
                  key={muscle}
                  label={muscle}
                  selected={form.selectedEMGMuscles.includes(muscle)}
                  onPress={() => toggleItem("selectedEMGMuscles", muscle)}
                  testID={`emg-muscle-chip-${muscle.replace(/\s+/g, "-").toLowerCase()}`}
                />
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Note any problems or signal loss</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={form.problemsOrSignalLoss}
                onChangeText={(v) => update("problemsOrSignalLoss", v)}
                placeholder="Describe any problems or signal loss..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                testID="problems-signal-loss-input"
              />
            </View>
            <Checkbox
              label="Diabetic"
              value={form.diabetic}
              onChange={(v) => update("diabetic", v)}
              testID="diabetic-checkbox"
            />
            <View style={[styles.field, { marginTop: 12 }]}>
              <Text style={styles.fieldLabel}>Patient History</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={form.patientHistory}
                onChangeText={(v) => update("patientHistory", v)}
                placeholder="Relevant patient history..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                testID="patient-history-input"
              />
            </View>
          </View>

          {/* Signature */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Signature</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Name of Technician *</Text>
              <TextInput
                style={styles.input}
                value={form.technicianSignature}
                onChangeText={(v) => update("technicianSignature", v)}
                placeholder="Technician name for signature"
                testID="technician-signature-name-input"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Technician Signature *</Text>
              <SignaturePad
                value={form.technicianSignature}
                onChange={(v) => update("technicianSignature", v)}
              />
            </View>
          </View>

          {isSubmitted ? (
            <View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.emailButton]}
                  onPress={handleEmailPdf}
                  disabled={emailLoading}
                  testID="email-pdf-button"
                >
                  {emailLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.actionButtonText}>Email PDF</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.shareButton]}
                  onPress={handleSharePdf}
                  disabled={shareLoading}
                  testID="share-pdf-button"
                >
                  {shareLoading ? (
                    <ActivityIndicator color="#6b21a8" size="small" />
                  ) : (
                    <Text style={[styles.actionButtonText, { color: "#6b21a8" }]}>Share PDF</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}
              testID="submit-button"
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit Case Study Checklist</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#3b0764" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b0764",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { paddingRight: 12 },
  backText: { color: "#d8b4fe", fontSize: 15, fontWeight: "600" },
  headerTitle: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  content: { padding: 16 },
  contentTablet: { alignItems: "center" },
  inner: { width: "100%" },
  innerTablet: { maxWidth: 800, width: "100%" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f4f8",
  },
  loadingText: { marginTop: 12, color: "#4a5568", fontSize: 16 },
  formHeader: {
    backgroundColor: "#3b0764",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  orgName: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 8 },
  formTitle: { fontSize: 15, fontWeight: "700", color: "#e9d5ff", lineHeight: 22 },
  formSubtitle: { fontSize: 13, color: "#c4b5fd", marginTop: 4 },
  savingText: { fontSize: 12, color: "#c4b5fd", marginTop: 6 },
  submittedBadge: {
    marginTop: 8,
    backgroundColor: "#6b21a8",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  submittedText: { color: "#f3e8ff", fontSize: 13, fontWeight: "700" },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3b0764",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 8,
  },
  field: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4a5568",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#f8fafc",
    color: "#1a202c",
  },
  multilineInput: {
    minHeight: 96,
    paddingTop: 12,
  },
  row: { flexDirection: "row", flexWrap: "wrap" },
  checkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  checkBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#cbd5e0",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    backgroundColor: "#fff",
  },
  checkBoxChecked: { backgroundColor: "#6b21a8", borderColor: "#6b21a8" },
  checkMark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  checkLabel: { fontSize: 13, color: "#2d3748", flex: 1 },
  chipGroup: { marginBottom: 12 },
  chipGroupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b21a8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 2,
  },
  chipSelected: { backgroundColor: "#6b21a8" },
  chipUnselected: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  chipTextSelected: { color: "#fff" },
  chipTextUnselected: { color: "#374151" },
  submitButton: {
    backgroundColor: "#6b21a8",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emailButton: { backgroundColor: "#6b21a8" },
  shareButton: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#6b21a8" },
  actionButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
