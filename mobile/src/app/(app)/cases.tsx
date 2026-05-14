import React from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
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

function formStatusDot(forms: FormSummary[]): { symbol: string; color: string } {
  if (forms.length === 0) return { symbol: "○", color: "#cbd5e0" };
  if (forms[0].status === "submitted") return { symbol: "✓", color: "#276749" };
  return { symbol: "●", color: "#d69e2e" };
}

export default function CasesScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["cases"],
    queryFn: () => api.get<PatientCase[]>("/api/cases"),
  });

  const cases = data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="cases-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Patient Cases</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading ? (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2b6cb0" />
          <Text style={styles.loadingText}>Loading cases...</Text>
        </View>
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={cases.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2b6cb0" />}
          ListEmptyComponent={
            <View style={styles.emptyState} testID="empty-state">
              <Text style={styles.emptyIcon}>🏥</Text>
              <Text style={styles.emptyTitle}>No patient cases yet</Text>
              <Text style={styles.emptyText}>Start a new case from the home screen.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const consent = formStatusDot(item.consentForms);
            const billing = formStatusDot(item.billingForms);
            const checklist = formStatusDot(item.caseStudyForms);
            const createdDate = new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => router.push(`/case/${item.id}` as never)}
                testID={`case-item-${item.id}`}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.patientName}>{item.patientName || "Unnamed Patient"}</Text>
                  <Text style={styles.createdAt}>{createdDate}</Text>
                </View>
                {item.date ? <Text style={styles.dateText}>{item.date}</Text> : null}
                <View style={styles.formDots}>
                  <View style={styles.dotItem}>
                    <Text style={[styles.dotSymbol, { color: consent.color }]}>{consent.symbol}</Text>
                    <Text style={styles.dotLabel}>Consent</Text>
                  </View>
                  <View style={styles.dotItem}>
                    <Text style={[styles.dotSymbol, { color: billing.color }]}>{billing.symbol}</Text>
                    <Text style={styles.dotLabel}>Billing</Text>
                  </View>
                  <View style={styles.dotItem}>
                    <Text style={[styles.dotSymbol, { color: checklist.color }]}>{checklist.symbol}</Text>
                    <Text style={styles.dotLabel}>Checklist</Text>
                  </View>
                  <Text style={styles.viewLink}>View →</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f0f4f8" },
  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1a365d", paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { paddingRight: 12 },
  backText: { color: "#90cdf4", fontSize: 15, fontWeight: "600" },
  headerTitle: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  headerRight: { width: 60 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#4a5568", fontSize: 15 },
  listContent: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1a365d", marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#718096", textAlign: "center", lineHeight: 22 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  cardPressed: { opacity: 0.85 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  patientName: { fontSize: 16, fontWeight: "700", color: "#1a365d", flex: 1, marginRight: 8 },
  createdAt: { fontSize: 12, color: "#a0aec0" },
  dateText: { fontSize: 13, color: "#4a5568", marginBottom: 10 },
  formDots: { flexDirection: "row", alignItems: "center", gap: 16 },
  dotItem: { alignItems: "center", gap: 2 },
  dotSymbol: { fontSize: 16, fontWeight: "700" },
  dotLabel: { fontSize: 10, color: "#718096", fontWeight: "600" },
  viewLink: { marginLeft: "auto" as never, fontSize: 13, color: "#2b6cb0", fontWeight: "600" },
});
