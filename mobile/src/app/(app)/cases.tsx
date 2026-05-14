import React from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/api";

type ConsentForm = {
  id: string;
  patientName: string;
  dateOfService: string;
  status: string;
  createdAt: string;
};

export default function CasesScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["consent-forms"],
    queryFn: () => api.get<ConsentForm[]>("/api/consent-forms"),
  });

  const forms = data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="cases-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Previous Cases</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading ? (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2b6cb0" />
          <Text style={styles.loadingText}>Loading cases...</Text>
        </View>
      ) : (
        <FlatList
          data={forms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={forms.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2b6cb0" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState} testID="empty-state">
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No cases yet</Text>
              <Text style={styles.emptyText}>Start a new case from the home screen to get started.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSubmitted = item.status === "submitted";
            const createdDate = new Date(item.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => router.push(`/consent-form/${item.id}`)}
                testID={`case-item-${item.id}`}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.patientName}>{item.patientName || "Unnamed Patient"}</Text>
                  <View style={[styles.badge, isSubmitted ? styles.badgeSubmitted : styles.badgeDraft]}>
                    <Text style={[styles.badgeText, isSubmitted ? styles.badgeTextSubmitted : styles.badgeTextDraft]}>
                      {isSubmitted ? "Submitted" : "Draft"}
                    </Text>
                  </View>
                </View>
                {item.dateOfService ? (
                  <Text style={styles.dateOfService}>Service: {item.dateOfService}</Text>
                ) : null}
                <Text style={styles.createdAt}>Created {createdDate}</Text>
                <Text style={styles.viewLink}>Tap to view →</Text>
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a365d",
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPressed: { opacity: 0.85 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  patientName: { fontSize: 16, fontWeight: "700", color: "#1a365d", flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeSubmitted: { backgroundColor: "#c6f6d5" },
  badgeDraft: { backgroundColor: "#e2e8f0" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  badgeTextSubmitted: { color: "#276749" },
  badgeTextDraft: { color: "#4a5568" },
  dateOfService: { fontSize: 13, color: "#4a5568", marginBottom: 2 },
  createdAt: { fontSize: 12, color: "#a0aec0", marginBottom: 8 },
  viewLink: { fontSize: 13, color: "#2b6cb0", fontWeight: "600" },
});
