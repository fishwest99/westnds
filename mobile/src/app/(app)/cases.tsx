import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, TextInput } from "react-native";
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
  surgeonName?: string;
  dateOfService?: string;
  technologistName?: string;
  billingForms: FormSummary[];
  consentForms: FormSummary[];
  caseStudyForms: FormSummary[];
};

function formStatusDot(forms: FormSummary[]): { symbol: string; color: string } {
  if (forms.length === 0) return { symbol: "○", color: "#cbd5e0" };
  if (forms[0].status === "submitted") return { symbol: "✓", color: "#276749" };
  return { symbol: "●", color: "#d69e2e" };
}

const fmtDate = (d: string) => {
  if (!d) return d;
  if (d.includes('/')) return d;
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
};

export default function CasesScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["cases"],
    queryFn: () => api.get<PatientCase[]>("/api/cases"),
  });

  const cases = data ?? [];
  const [query, setQuery] = useState<string>("");

  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) => {
      const name = (c.patientName ?? "").toLowerCase();
      const date = (c.date ?? "").toLowerCase();
      const dos = (c.dateOfService ?? "").toLowerCase();
      const surgeon = (c.surgeonName ?? "").toLowerCase();
      const tech = (c.technologistName ?? "").toLowerCase();
      const created = new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toLowerCase();
      return name.includes(q) || date.includes(q) || dos.includes(q) || surgeon.includes(q) || tech.includes(q) || created.includes(q);
    });
  }, [cases, query]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="cases-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Patient Cases</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by patient, technologist, date, or surgeon"
            placeholderTextColor="#a0aec0"
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            testID="patient-search-input"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} testID="clear-search-button" hitSlop={10}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2b6cb0" />
          <Text style={styles.loadingText}>Loading cases...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={filteredCases.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2b6cb0" />}
          ListEmptyComponent={
            <View style={styles.emptyState} testID="empty-state">
              <Text style={styles.emptyIcon}>{query ? "🔎" : "🏥"}</Text>
              <Text style={styles.emptyTitle}>{query ? "No matching cases" : "No patient cases yet"}</Text>
              <Text style={styles.emptyText}>{query ? "Try a different patient name or date." : "Start a new case from the home screen."}</Text>
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
                {item.date ? <Text style={styles.dateText}>{fmtDate(item.date)}</Text> : null}
                {item.surgeonName ? <Text style={styles.surgeonText}>Surgeon: {item.surgeonName}</Text> : null}
                {item.technologistName ? <Text style={styles.technologistText}>Technologist: {item.technologistName}</Text> : null}
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
  searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: "#f0f4f8" },
  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  searchIcon: { fontSize: 15, color: "#718096" },
  searchInput: { flex: 1, fontSize: 15, color: "#1a365d", padding: 0 },
  clearIcon: { fontSize: 14, color: "#a0aec0", fontWeight: "700", paddingHorizontal: 4 },
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
  dateText: { fontSize: 13, color: "#4a5568", marginBottom: 4 },
  surgeonText: { fontSize: 13, color: "#4a5568", marginBottom: 4 },
  technologistText: { fontSize: 13, color: "#2b6cb0", fontWeight: "600", marginBottom: 10 },
  formDots: { flexDirection: "row", alignItems: "center", gap: 16 },
  dotItem: { alignItems: "center", gap: 2 },
  dotSymbol: { fontSize: 16, fontWeight: "700" },
  dotLabel: { fontSize: 10, color: "#718096", fontWeight: "600" },
  viewLink: { marginLeft: "auto" as never, fontSize: 13, color: "#2b6cb0", fontWeight: "600" },
});
