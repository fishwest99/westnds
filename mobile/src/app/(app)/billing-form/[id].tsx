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

type BillingFormData = {
  id?: string;
  status: string;
  invoiceNumber: string;
  poNumber: string;
  patientName: string;
  age: string;
  genderMale: boolean;
  genderFemale: boolean;
  referringDoctor: string;
  roomNumber: string;
  patientAcctNumber: string;
  patientMRN: string;
  techName: string;
  facility: string;
  date: string;
  procedure: string;
  cptVisual: string;
  cptAuditory: string;
  cptUpperExtremities: string;
  cptLowerExtremities: string;
  cptUpperMotorEP: string;
  cptLowerMotorEP: string;
  cptRLNMonitoring: string;
  cptTwoExtEMG: string;
  cptFourExtEMG: string;
  cptCranialUnilateral: string;
  cptCranialBilateral: string;
  cptElectrocorticography: string;
  cptStatFee: string;
  cptStandby: string;
  standbyHours: string;
  cptEEG: string;
  flatFeeMEP: string;
  baseline: string;
  startTime: string;
  endTime: string;
  electrodesUsed: string;
  thyroidKit: string;
  ssepEMG: string;
  fluobeam: string;
  needleCount: string;
  needlesUsed: string;
  needlesRemoved: string;
  totalHours: string;
  drivingTime: string;
  computerUsed: string;
  cancellation: string;
  neurologist: string;
  technicianSignature: string;
  technicianSignatureDate: string;
  rnSignature: string;
  rnSignatureDate: string;
};

const defaultForm: BillingFormData = {
  status: "draft",
  invoiceNumber: "", poNumber: "",
  patientName: "", age: "", genderMale: false, genderFemale: false,
  referringDoctor: "", roomNumber: "", patientAcctNumber: "", patientMRN: "", techName: "",
  facility: "", date: "", procedure: "",
  cptVisual: "", cptAuditory: "", cptUpperExtremities: "", cptLowerExtremities: "",
  cptUpperMotorEP: "", cptLowerMotorEP: "", cptRLNMonitoring: "",
  cptTwoExtEMG: "", cptFourExtEMG: "", cptCranialUnilateral: "", cptCranialBilateral: "",
  cptElectrocorticography: "", cptStatFee: "", cptStandby: "", standbyHours: "",
  cptEEG: "", flatFeeMEP: "", baseline: "",
  startTime: "", endTime: "", electrodesUsed: "", thyroidKit: "",
  ssepEMG: "", fluobeam: "", needleCount: "", needlesUsed: "", needlesRemoved: "",
  totalHours: "", drivingTime: "", computerUsed: "", cancellation: "", neurologist: "",
  technicianSignature: "", technicianSignatureDate: "", rnSignature: "", rnSignatureDate: "",
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

function ModalityRow({ label, cptCode, value, onChange }: {
  label: string; cptCode: string; value: string; onChange: (v: string) => void;
}) {
  const isYes = value === "yes";
  return (
    <View style={styles.modalityRow}>
      <View style={styles.modalityLabelCol}>
        <Text style={styles.modalityLabel}>{label}</Text>
        {cptCode ? <Text style={styles.cptCode}>{cptCode}</Text> : null}
      </View>
      <Pressable
        style={[styles.modalityToggle, isYes && styles.modalityToggleOn]}
        onPress={() => onChange(isYes ? "" : "yes")}
      >
        <Text style={[styles.modalityToggleText, isYes && styles.modalityToggleTextOn]}>
          {isYes ? "Yes" : "No"}
        </Text>
      </Pressable>
    </View>
  );
}

function formatMilitaryTime(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function calcHours(start: string, end: string): string | null {
  const parse = (t: string) => {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
    return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
  };
  const s = parse(start);
  const e = parse(end);
  if (s === null || e === null) return null;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  const rounded = Math.ceil(diff / 15) * 15;
  return (rounded / 60).toFixed(2);
}

export default function EditBillingFormScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [form, setForm] = useState<BillingFormData>(defaultForm);
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
      const result = await api.get<BillingFormData & { id: string }>(`/api/billing-forms/${formId}`);
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

  const saveForm = useCallback((updatedForm: BillingFormData) => {
    if (!id) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.put(`/api/billing-forms/${id}`, updatedForm);
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [id]);

  const update = (key: keyof BillingFormData, value: string | boolean) => {
    const updated = { ...form, [key]: value };
    if (key === "genderMale" && value === true) updated.genderFemale = false;
    if (key === "genderFemale" && value === true) updated.genderMale = false;
    if (key === "startTime" || key === "endTime") {
      const start = key === "startTime" ? value as string : form.startTime;
      const end = key === "endTime" ? value as string : form.endTime;
      const computed = calcHours(start, end);
      if (computed !== null) updated.totalHours = computed;
    }
    setForm(updated);
    saveForm(updated);
  };

  const needleMismatch =
    form.needlesUsed.trim() !== "" &&
    form.needlesRemoved.trim() !== "" &&
    form.needlesUsed.trim() !== form.needlesRemoved.trim();

  const handleSubmit = async () => {
    if (!id) return;
    if (!form.patientName.trim() || !form.technicianSignature.trim()) {
      Alert.alert("Required", "Please provide patient name and technician signature before submitting.");
      return;
    }
    if (needleMismatch) {
      Alert.alert("Needle Count Mismatch", "Needles Used and Needles Removed must match before submitting.");
      return;
    }
    Alert.alert(
      "Submit Billing Sheet",
      "Are you sure you want to submit this billing sheet?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.post(`/api/billing-forms/${id}/submit`, {});
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
    const destination = new FSFile(Paths.cache, `billing-form-${id}.pdf`);
    try {
      const result = await FSFile.downloadFileAsync(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/billing-forms/${id}/pdf`,
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
        subject: `West NDx Billing Sheet - ${form.patientName || "Patient"}`,
        body: `Attached: completed billing sheet.\n\nPatient: ${form.patientName || ""}\nDate: ${form.date || ""}\nInvoice #: ${form.invoiceNumber || ""}`,
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
        dialogTitle: "Share Billing Sheet PDF",
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
    <SafeAreaView style={styles.safe} edges={["top"]} testID="edit-billing-form-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{form.patientName || "Billing Sheet"}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}>
        <View style={[styles.inner, isTablet && styles.innerTablet]}>

          {/* Form Header */}
          <View style={styles.formHeader}>
            <Text style={styles.orgName}>West NDx</Text>
            <Text style={styles.formTitle}>Billing Sheet</Text>
            <Text style={styles.formSubtitle}>Intraoperative Neuromonitoring Services</Text>
            {saving ? <Text style={styles.savingText}>Saving...</Text> : null}
            {isSubmitted ? (
              <View style={styles.submittedBadge}>
                <Text style={styles.submittedText}>✓ Submitted</Text>
              </View>
            ) : null}
          </View>

          {/* Header: Invoice / PO */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invoice Information</Text>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Invoice #</Text>
                <TextInput
                  style={styles.input}
                  value={form.invoiceNumber}
                  onChangeText={(v) => update("invoiceNumber", v)}
                  placeholder="Invoice number"
                  testID="invoice-number-input"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>P.O. #</Text>
                <TextInput
                  style={styles.input}
                  value={form.poNumber}
                  onChangeText={(v) => update("poNumber", v)}
                  placeholder="P.O. number"
                  testID="po-number-input"
                />
              </View>
            </View>
          </View>

          {/* Patient Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Patient Information</Text>
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
                <Text style={styles.fieldLabel}>Age</Text>
                <TextInput
                  style={styles.input}
                  value={form.age}
                  onChangeText={(v) => update("age", v)}
                  placeholder="Age"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.field, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>Gender</Text>
                <View style={styles.row}>
                  <View style={{ marginRight: 16 }}>
                    <Checkbox label="Male" value={form.genderMale} onChange={(v) => update("genderMale", v)} />
                  </View>
                  <Checkbox label="Female" value={form.genderFemale} onChange={(v) => update("genderFemale", v)} />
                </View>
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Referring Doctor</Text>
              <TextInput
                style={styles.input}
                value={form.referringDoctor}
                onChangeText={(v) => update("referringDoctor", v)}
                placeholder="Referring doctor name"
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Room #</Text>
                <TextInput
                  style={styles.input}
                  value={form.roomNumber}
                  onChangeText={(v) => update("roomNumber", v)}
                  placeholder="Room #"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Patient Acct #</Text>
                <TextInput
                  style={styles.input}
                  value={form.patientAcctNumber}
                  onChangeText={(v) => update("patientAcctNumber", v)}
                  placeholder="Patient Acct #"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Patient MRN</Text>
              <TextInput
                style={styles.input}
                value={form.patientMRN}
                onChangeText={(v) => update("patientMRN", v)}
                placeholder="Patient MRN"
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Tech</Text>
                <TextInput
                  style={styles.input}
                  value={form.techName}
                  onChangeText={(v) => update("techName", v)}
                  placeholder="Technician name"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Date</Text>
                <DatePickerInput
                  value={form.date}
                  onChange={(v) => update("date", v)}
                  format="MM/DD/YYYY"
                  testID="date-picker"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Facility</Text>
              <TextInput
                style={styles.input}
                value={form.facility}
                onChangeText={(v) => update("facility", v)}
                placeholder="Facility name"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Procedure</Text>
              <TextInput
                style={styles.input}
                value={form.procedure}
                onChangeText={(v) => update("procedure", v)}
                placeholder="Describe procedure"
              />
            </View>
          </View>

          {/* Evoked Potentials */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Modalities — Evoked Potentials</Text>
            <View style={styles.modalityHeader}>
              <Text style={[styles.modalityHeaderText, { flex: 1 }]}>Procedure</Text>
              <Text style={[styles.modalityHeaderText, { width: 52, textAlign: "center" }]}>Used</Text>
            </View>
            <ModalityRow
              label="Visual" cptCode="95930"
              value={form.cptVisual} onChange={(v) => update("cptVisual", v)}
            />
            <ModalityRow
              label="Auditory" cptCode="92585"
              value={form.cptAuditory} onChange={(v) => update("cptAuditory", v)}
            />
            <ModalityRow
              label="Upper Extremities" cptCode="95938"
              value={form.cptUpperExtremities} onChange={(v) => update("cptUpperExtremities", v)}
            />
            <ModalityRow
              label="Lower Extremities" cptCode="95938"
              value={form.cptLowerExtremities} onChange={(v) => update("cptLowerExtremities", v)}
            />
            <ModalityRow
              label="Upper Motor EP" cptCode="95939"
              value={form.cptUpperMotorEP} onChange={(v) => update("cptUpperMotorEP", v)}
            />
            <ModalityRow
              label="Lower Motor EP" cptCode="95939"
              value={form.cptLowerMotorEP} onChange={(v) => update("cptLowerMotorEP", v)}
            />
            <ModalityRow
              label="RLN Monitoring" cptCode="95870"
              value={form.cptRLNMonitoring} onChange={(v) => update("cptRLNMonitoring", v)}
            />
          </View>

          {/* EMG / Nerve Conduction */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Modalities — EMG / Nerve Conduction / Pedicle Screw Stim</Text>
            <View style={styles.modalityHeader}>
              <Text style={[styles.modalityHeaderText, { flex: 1 }]}>Procedure</Text>
              <Text style={[styles.modalityHeaderText, { width: 52, textAlign: "center" }]}>Used</Text>
            </View>
            <ModalityRow
              label="Two Extremities EMG" cptCode="95861"
              value={form.cptTwoExtEMG} onChange={(v) => update("cptTwoExtEMG", v)}
            />
            <ModalityRow
              label="Four Extremities EMG" cptCode="95864"
              value={form.cptFourExtEMG} onChange={(v) => update("cptFourExtEMG", v)}
            />
            <ModalityRow
              label="Cranial Nerves Unilateral" cptCode="95870"
              value={form.cptCranialUnilateral} onChange={(v) => update("cptCranialUnilateral", v)}
            />
            <ModalityRow
              label="Cranial Nerves Bilateral" cptCode="95870"
              value={form.cptCranialBilateral} onChange={(v) => update("cptCranialBilateral", v)}
            />
            <ModalityRow
              label="Electrocorticography" cptCode="95955"
              value={form.cptElectrocorticography} onChange={(v) => update("cptElectrocorticography", v)}
            />
            <ModalityRow
              label="Stat Fee" cptCode="00000"
              value={form.cptStatFee} onChange={(v) => update("cptStatFee", v)}
            />
            <ModalityRow
              label="Standby" cptCode=""
              value={form.cptStandby} onChange={(v) => update("cptStandby", v)}
            />
            <View style={[styles.field, { paddingHorizontal: 12, paddingBottom: 8 }]}>
              <Text style={styles.fieldLabel}>Standby Hours</Text>
              <TextInput
                style={styles.input}
                value={form.standbyHours}
                onChangeText={(v) => update("standbyHours", v)}
                placeholder="0"
                keyboardType="numeric"
                testID="standby-hours-input"
              />
            </View>
          </View>

          {/* EEG & MEP Monitoring */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EEG & MEP Monitoring</Text>
            <View style={styles.modalityHeader}>
              <Text style={[styles.modalityHeaderText, { flex: 1 }]}>Procedure</Text>
              <Text style={[styles.modalityHeaderText, { width: 52, textAlign: "center" }]}>Used</Text>
            </View>
            <ModalityRow
              label="Electroencephalography — Continuous EEG" cptCode="95955"
              value={form.cptEEG} onChange={(v) => update("cptEEG", v)}
            />
            <ModalityRow
              label="Motor Evoked Potentials" cptCode=""
              value={form.flatFeeMEP} onChange={(v) => update("flatFeeMEP", v)}
            />
            <ModalityRow
              label="Baseline" cptCode=""
              value={form.baseline} onChange={(v) => update("baseline", v)}
            />
          </View>

          {/* Timing & Equipment */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timing & Equipment</Text>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Start Time (Military)</Text>
                <TextInput
                  style={styles.input}
                  value={form.startTime}
                  onChangeText={(v) => update("startTime", formatMilitaryTime(v))}
                  placeholder="--:--"
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>End Time (Military)</Text>
                <TextInput
                  style={styles.input}
                  value={form.endTime}
                  onChangeText={(v) => update("endTime", formatMilitaryTime(v))}
                  placeholder="--:--"
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>
            <ModalityRow label="Thyroid Kit / Facial Kit" cptCode="" value={form.thyroidKit} onChange={(v) => update("thyroidKit", v)} />
            <ModalityRow label="SSEP / EMG" cptCode="" value={form.ssepEMG} onChange={(v) => update("ssepEMG", v)} />
            <ModalityRow label="Fluobeam" cptCode="" value={form.fluobeam} onChange={(v) => update("fluobeam", v)} />
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Needles Used</Text>
                <TextInput
                  style={[styles.input, needleMismatch ? { borderColor: "#c53030", backgroundColor: "#fff5f5" } : null]}
                  value={form.needlesUsed}
                  onChangeText={(v) => update("needlesUsed", v)}
                  placeholder="Count"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Needles Removed</Text>
                <TextInput
                  style={[styles.input, needleMismatch ? { borderColor: "#c53030", backgroundColor: "#fff5f5" } : null]}
                  value={form.needlesRemoved}
                  onChangeText={(v) => update("needlesRemoved", v)}
                  placeholder="Count"
                  keyboardType="numeric"
                />
              </View>
            </View>
            {needleMismatch ? (
              <View style={{ backgroundColor: "#fff5f5", borderWidth: 1, borderColor: "#c53030", borderRadius: 8, padding: 12, marginTop: 8 }}>
                <Text style={{ color: "#c53030", fontSize: 13, fontWeight: "600" }}>⚠ Needles Used and Needles Removed must match before submitting.</Text>
              </View>
            ) : null}
          </View>

          {/* Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Total Hours (95940, 95941, G0453)</Text>
              <TextInput
                style={styles.input}
                value={form.totalHours}
                onChangeText={(v) => update("totalHours", v)}
                placeholder="Total hours"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Driving Time (minutes)</Text>
              <TextInput
                style={styles.input}
                value={form.drivingTime}
                onChangeText={(v) => update("drivingTime", v)}
                placeholder="0"
                keyboardType="numeric"
                testID="driving-time-input"
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Computer Used</Text>
                <TextInput
                  style={styles.input}
                  value={form.computerUsed}
                  onChangeText={(v) => update("computerUsed", v)}
                  placeholder="Computer ID"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Cancellation</Text>
                <TextInput
                  style={styles.input}
                  value={form.cancellation}
                  onChangeText={(v) => update("cancellation", v)}
                  placeholder="Notes"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Neurologist</Text>
              <TextInput
                style={styles.input}
                value={form.neurologist}
                onChangeText={(v) => update("neurologist", v)}
                placeholder="Neurologist name"
              />
            </View>
          </View>

          {/* Signatures */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Signatures</Text>

            <Text style={styles.sigGroupLabel}>Technician</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Technician Signature *</Text>
              <SignaturePad
                value={form.technicianSignature}
                onChange={(v) => update("technicianSignature", v)}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date</Text>
              <DatePickerInput
                value={form.technicianSignatureDate}
                onChange={(v) => update("technicianSignatureDate", v)}
                format="MM/DD/YYYY"
                testID="technician-date-input"
              />
            </View>

            <View style={styles.divider} />

            <Text style={styles.sigGroupLabel}>RN</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>RN Signature</Text>
              <SignaturePad
                value={form.rnSignature}
                onChange={(v) => update("rnSignature", v)}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date</Text>
              <DatePickerInput
                value={form.rnSignatureDate}
                onChange={(v) => update("rnSignatureDate", v)}
                format="MM/DD/YYYY"
                testID="rn-date-input"
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
                : <Text style={styles.submitText}>Submit Billing Sheet</Text>}
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
  halfCell: { width: "50%" },
  checkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  checkBox: { width: 20, height: 20, borderWidth: 2, borderColor: "#cbd5e0", borderRadius: 4, justifyContent: "center", alignItems: "center", marginRight: 8, backgroundColor: "#fff" },
  checkBoxChecked: { backgroundColor: "#2b6cb0", borderColor: "#2b6cb0" },
  checkMark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  checkLabel: { fontSize: 13, color: "#2d3748", flex: 1 },
  modalityHeader: { flexDirection: "row", marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  modalityHeaderText: { fontSize: 11, fontWeight: "700", color: "#718096", textTransform: "uppercase", letterSpacing: 0.4 },
  modalityRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f0f4f8" },
  modalityLabelCol: { flex: 1, paddingRight: 8 },
  modalityLabel: { fontSize: 14, color: "#2d3748", fontWeight: "500" },
  cptCode: { fontSize: 11, color: "#718096", marginTop: 1 },
  modalityInput: { width: 60, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 6, padding: 8, fontSize: 14, backgroundColor: "#f8fafc", color: "#1a202c" },
  modalityToggle: { width: 52, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: "#cbd5e0", backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" },
  modalityToggleOn: { backgroundColor: "#276749", borderColor: "#276749" },
  modalityToggleText: { fontSize: 13, fontWeight: "700" as const, color: "#a0aec0" },
  modalityToggleTextOn: { color: "#fff" },
  divider: { borderTopWidth: 1, borderTopColor: "#e2e8f0", marginVertical: 16 },
  sigGroupLabel: { fontSize: 13, fontWeight: "700", color: "#2b6cb0", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10, marginTop: 4 },
  submitButton: { backgroundColor: "#276749", borderRadius: 12, padding: 18, alignItems: "center", marginTop: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  actionButton: { flex: 1, borderRadius: 12, padding: 16, alignItems: "center", justifyContent: "center" },
  emailButton: { backgroundColor: "#276749" },
  shareButton: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#2b6cb0" },
  actionButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  inputError: { borderColor: "#c53030", backgroundColor: "#fff5f5" },
  needleWarning: { backgroundColor: "#fff5f5", borderWidth: 1, borderColor: "#c53030", borderRadius: 8, padding: 12, marginTop: 8 },
  needleWarningText: { color: "#c53030", fontSize: 13, fontWeight: "600" as const },
});
