import React from "react";
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/api";

type RoleRequest = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  requestedRole: string;
  status: string;
  reviewedBy: string | null;
  createdAt: string;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function RoleRequestsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["role-requests"],
    queryFn: () => api.get<RoleRequest[]>("/api/role-requests"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/role-requests/${id}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["role-requests"] }),
  });

  const denyMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/role-requests/${id}/deny`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["role-requests"] }),
  });

  const requests = data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="role-requests-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Role Requests</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2b6cb0" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2b6cb0" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState} testID="empty-state">
              <Text style={styles.emptyIcon}>✓</Text>
              <Text style={styles.emptyTitle}>No pending role requests</Text>
              <Text style={styles.emptyText}>All role requests have been reviewed.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isManagerRole = item.requestedRole.toLowerCase() === "manager";
            const isApproving = approveMutation.isPending && approveMutation.variables === item.id;
            const isDenying = denyMutation.isPending && denyMutation.variables === item.id;

            return (
              <View style={styles.card} testID={`role-request-${item.id}`}>
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.userName}>{item.userName}</Text>
                    <Text style={styles.userEmail}>{item.userEmail}</Text>
                  </View>
                  <View style={[styles.roleBadge, isManagerRole ? styles.roleBadgeManager : styles.roleBadgeTech]}>
                    <Text style={[styles.roleBadgeText, isManagerRole ? styles.roleBadgeTextManager : styles.roleBadgeTextTech]}>
                      {isManagerRole ? "Manager" : "Technician"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.dateSubmitted}>Submitted {formatDate(item.createdAt)}</Text>

                <View style={styles.actions}>
                  <Pressable
                    style={({ pressed }) => [styles.approveBtn, pressed && { opacity: 0.8 }, isApproving && styles.btnDisabled]}
                    onPress={() => approveMutation.mutate(item.id)}
                    disabled={isApproving || isDenying}
                    testID={`approve-button-${item.id}`}
                  >
                    {isApproving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.approveBtnText}>Approve</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.denyBtn, pressed && { opacity: 0.8 }, isDenying && styles.btnDisabled]}
                    onPress={() => denyMutation.mutate(item.id)}
                    disabled={isApproving || isDenying}
                    testID={`deny-button-${item.id}`}
                  >
                    {isDenying ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.denyBtnText}>Deny</Text>
                    )}
                  </Pressable>
                </View>
              </View>
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#4a5568", fontSize: 15 },
  listContent: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 48 },
  emptyState: { alignItems: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 16, color: "#276749" },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1a365d", marginBottom: 8, textAlign: "center" },
  emptyText: { fontSize: 14, color: "#718096", textAlign: "center", lineHeight: 22 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardInfo: { flex: 1, marginRight: 12 },
  userName: { fontSize: 16, fontWeight: "700", color: "#1a365d" },
  userEmail: { fontSize: 13, color: "#718096", marginTop: 2 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleBadgeManager: { backgroundColor: "#fef3c7" },
  roleBadgeTech: { backgroundColor: "#ebf4ff" },
  roleBadgeText: { fontSize: 12, fontWeight: "700" },
  roleBadgeTextManager: { color: "#92400e" },
  roleBadgeTextTech: { color: "#2b6cb0" },
  dateSubmitted: { fontSize: 12, color: "#a0aec0", marginBottom: 14 },
  actions: { flexDirection: "row", gap: 10 },
  approveBtn: {
    flex: 1,
    backgroundColor: "#276749",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  approveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  denyBtn: {
    flex: 1,
    backgroundColor: "#e53e3e",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  denyBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
});
