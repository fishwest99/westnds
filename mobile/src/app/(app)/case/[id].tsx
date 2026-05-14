import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/api";

type FormSummary = { id: string; status: string };
type PatientCase = {
  id: string;
  patientName: string;
  date: string;
  status: string;
  createdAt: string;
  billingForms: FormSummary[];
  consentForms: FormSummary[];
  caseStudyForms: FormSummary[];
};

type FormCard = {
  key: keyof Pick<PatientCase, "consentForms" | "billingForms" | "caseStudyForms">;
  label: string;
  icon: string;
  accent: string;
  bg: string;
  createEndpoint: string;
  viewPath: string;
  extraData: Record<string, unknown>;
};

const FORM_CARDS: FormCard[] = [
  {
    key: "consentForms",
    label: "Consent Form",
    icon: "📋",
    accent: "#2b6cb0",
    bg: "#ebf4ff",
    createEndpoint: "/api/consent-forms",
    viewPath: "/consent-form",
    extraData: {},
  },
  {
    key: "billingForms",
    label: "Billing Sheet",
    icon: "🧾",
    accent: "#276749",
    bg: "#e6ffef",
    createEndpoint: "/api/billing-forms",
    viewPath: "/billing-form",
    extraData: {},
  },
  {
    key: "caseStudyForms",
    label: "Case Study Checklist",
    icon: "🧠",
    accent: "#6b21a8",
    bg: "#faf5ff",
    createEndpoint: "/api/case-study-forms",
    viewPath: "/case-study-form",
    extraData: {},
  },
];

function statusBadge(forms: FormSummary[]): { label: string; color: string; bg: string } {
  if (forms.length === 0) return { label: "Not Started", color: "#718096", bg: "#edf2f7" };
  const latest = forms[0];
  if (latest.status === "submitted") return { label: "Submitted", color: "#276749", bg: "#c6f6d5" };
  return { label: "In Progress", color: "#b7791f", bg: "#fefcbf" };
}

export default function PatientCaseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [creatingForm, setCreatingForm] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["case", id],
    queryFn: () => api.get<PatientCase>(`/api/cases/${id}`),
    enabled: !!id,
  });

  const closeMutation = useMutation({
    mutationFn: () => api.put(`/api/cases/${id}`, { status: "closed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", id] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      setShowCloseModal(false);
    },
  });

  const handleFormPress = async (card: FormCard) => {
    if (!data) return;
    const existing = data[card.key];
    if (existing.length > 0) {
      router.push(`${card.viewPath}/${existing[0].id}` as never);
      return;
    }
    setCreatingForm(card.key);
    try {
      const result = await api.post<{ id: string }>(card.createEndpoint, {
        caseId: id,
        patientName: data.patientName,
        ...card.extraData,
      });
      if (result?.id) {
        await queryClient.invalidateQueries({ queryKey: ["case", id] });
        router.push(`${card.viewPath}/${result.id}` as never);
      }
    } finally {
      setCreatingForm(null);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
            <Text style={styles.backText}>← Cases</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2b6cb0" />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
            <Text style={styles.backText}>← Cases</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Not Found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="patient-case-screen">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2b6cb0" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
            <Text style={styles.backText}>← Cases</Text>
          </Pressable>
          <Text style={styles.patientName}>{data.patientName}</Text>
          {data.date ? <Text style={styles.dateText}>{data.date}</Text> : null}
          {data.status === "closed"
            ? <View style={styles.closedBadge}><Text style={styles.closedBadgeText}>✓ Case Closed</Text></View>
            : <Text style={styles.headerSub}>Select a form to fill out</Text>}
        </View>

        {/* Form Cards */}
        <View style={styles.cards}>
          {FORM_CARDS.map((card) => {
            const forms = data[card.key];
            const badge = statusBadge(forms);
            const isCreating = creatingForm === card.key;
            return (
              <Pressable
                key={card.key}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: card.bg, opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={() => handleFormPress(card)}
                disabled={isCreating}
                testID={`form-card-${card.key}`}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.iconWrap, { backgroundColor: card.accent + "22" }]}>
                    <Text style={styles.cardIcon}>{card.icon}</Text>
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.cardLabel, { color: card.accent }]}>{card.label}</Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  </View>
                  <View style={[styles.arrowBtn, { backgroundColor: card.accent }]}>
                    {isCreating
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.arrowText}>{forms.length > 0 ? "→" : "+"}</Text>}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Other Documents */}
        <View style={styles.cards}>
          <Pressable
            style={({ pressed }) => [styles.card, { backgroundColor: "#edf2f7", opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push("/hp-scan" as never)}
            testID="form-card-otherDocuments"
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconWrap, { backgroundColor: "#2d374822" }]}>
                <Text style={styles.cardIcon}>📷</Text>
              </View>
              <View style={styles.cardMeta}>
                <Text style={[styles.cardLabel, { color: "#2d3748" }]}>Other Documents</Text>
                <Text style={{ fontSize: 12, color: "#718096" }}>Scan & upload documents</Text>
              </View>
              <View style={[styles.arrowBtn, { backgroundColor: "#2d3748" }]}>
                <Text style={styles.arrowText}>→</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Close Out Case */}
        {data.status !== "closed" && (
          <View style={styles.closeSection}>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => setShowCloseModal(true)}
              testID="close-case-button"
            >
              <Text style={styles.closeBtnText}>Close Out Case</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={showCloseModal} transparent animationType="fade" onRequestClose={() => setShowCloseModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Close Out Case?</Text>
            <Text style={styles.modalBody}>
              This will mark the case for {data.patientName} as closed. You can still view the forms but no further changes are expected.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowCloseModal(false)}
                testID="cancel-close-button"
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                testID="confirm-close-button"
              >
                {closeMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalBtnConfirmText}>Close Case</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a365d" },
  scroll: { flex: 1, backgroundColor: "#f0f4f8" },
  content: { paddingBottom: 24 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f0f4f8" },
  header: {
    backgroundColor: "#1a365d",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 24,
  },
  backBtn: { marginBottom: 14 },
  backText: { color: "#90cdf4", fontSize: 14, fontWeight: "600" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  patientName: { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  dateText: { fontSize: 14, color: "#bee3f8", marginTop: 4 },
  headerSub: { fontSize: 13, color: "#90cdf4", marginTop: 6 },
  cards: { paddingHorizontal: 16, gap: 12 },
  card: {
    borderRadius: 16, padding: 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  cardRow: { flexDirection: "row", alignItems: "center" },
  iconWrap: { width: 46, height: 46, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 14 },
  cardIcon: { fontSize: 22 },
  cardMeta: { flex: 1 },
  cardLabel: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  arrowBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginLeft: 10 },
  arrowText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  closedBadge: { marginTop: 8, alignSelf: "flex-start", backgroundColor: "#276749", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  closedBadgeText: { color: "#c6f6d5", fontSize: 13, fontWeight: "700" as const },
  closeSection: { paddingHorizontal: 16, marginTop: 24 },
  closeBtn: { backgroundColor: "#c53030", borderRadius: 14, padding: 18, alignItems: "center" as const, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  closeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" as const, letterSpacing: 0.3 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center" as const, alignItems: "center" as const, padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%" as const, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  modalTitle: { fontSize: 20, fontWeight: "800" as const, color: "#1a202c", marginBottom: 10 },
  modalBody: { fontSize: 15, color: "#4a5568", lineHeight: 22, marginBottom: 24 },
  modalActions: { flexDirection: "row" as const, gap: 12 },
  modalBtn: { flex: 1, borderRadius: 12, padding: 15, alignItems: "center" as const, justifyContent: "center" as const },
  modalBtnCancel: { backgroundColor: "#edf2f7" },
  modalBtnCancelText: { fontSize: 15, fontWeight: "700" as const, color: "#4a5568" },
  modalBtnConfirm: { backgroundColor: "#c53030" },
  modalBtnConfirmText: { fontSize: 15, fontWeight: "700" as const, color: "#fff" },
});
