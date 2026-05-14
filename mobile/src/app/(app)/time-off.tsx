import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, RefreshControl, TextInput, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/api";
import { DatePickerInput } from "@/components/DatePickerInput";

type TimeOffRequest = {
  id: string;
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  reviewedBy: string | null;
  createdAt: string;
};

type UserProfile = { isManager: boolean };

const fmtDate = (d: string) => {
  if (!d) return d;
  if (d.includes('/')) return d;
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
};

export default function TimeOffScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [modalVisible, setModalVisible] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => api.get<UserProfile>("/api/time-off/my-profile"),
  });

  const isManager = profile?.isManager ?? false;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["time-off", tab],
    queryFn: () => api.get<TimeOffRequest[]>("/api/time-off"),
  });

  const createMutation = useMutation({
    mutationFn: (req: { startDate: string; endDate: string; reason: string }) =>
      api.post<TimeOffRequest>("/api/time-off", req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off"] });
      setModalVisible(false);
      setStartDate("");
      setEndDate("");
      setReason("");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post<TimeOffRequest>(`/api/time-off/${id}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["time-off"] }),
  });

  const denyMutation = useMutation({
    mutationFn: (id: string) => api.post<TimeOffRequest>(`/api/time-off/${id}/deny`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["time-off"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/time-off/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["time-off"] }),
  });

  const allRequests = data ?? [];
  const displayed = tab === "mine"
    ? allRequests.filter((r) => !isManager || r.userId !== undefined)
    : allRequests;

  const statusColor = (status: string) => {
    if (status === "approved") return { bg: "#c6f6d5", text: "#276749" };
    if (status === "denied") return { bg: "#fed7d7", text: "#c53030" };
    return { bg: "#fefcbf", text: "#b7791f" };
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="time-off-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Time Off</Text>
        <Pressable onPress={() => setModalVisible(true)} style={styles.addBtn} testID="add-request-button">
          <Text style={styles.addBtnText}>+ New</Text>
        </Pressable>
      </View>

      {isManager ? (
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === "mine" && styles.tabActive]}
            onPress={() => setTab("mine")}
            testID="tab-mine"
          >
            <Text style={[styles.tabText, tab === "mine" && styles.tabTextActive]}>My Requests</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "all" && styles.tabActive]}
            onPress={() => setTab("all")}
            testID="tab-all"
          >
            <Text style={[styles.tabText, tab === "all" && styles.tabTextActive]}>All Requests</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2b6cb0" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={displayed.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2b6cb0" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState} testID="empty-state">
              <Text style={styles.emptyIcon}>🏖</Text>
              <Text style={styles.emptyTitle}>No requests yet</Text>
              <Text style={styles.emptyText}>Tap "+ New" to submit a time off request.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const colors = statusColor(item.status);
            const isPending = item.status === "pending";
            return (
              <View style={styles.card} testID={`request-item-${item.id}`}>
                <View style={styles.cardTop}>
                  <View>
                    <Text style={styles.cardName}>{item.userName}</Text>
                    <Text style={styles.cardDates}>{fmtDate(item.startDate)} — {fmtDate(item.endDate)}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.badgeText, { color: colors.text }]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>
                {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
                {item.reviewedBy ? (
                  <Text style={styles.reviewedBy}>Reviewed by {item.reviewedBy}</Text>
                ) : null}
                {isManager && isPending ? (
                  <View style={styles.managerActions}>
                    <Pressable
                      style={styles.approveBtn}
                      onPress={() => approveMutation.mutate(item.id)}
                      testID={`approve-${item.id}`}
                    >
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </Pressable>
                    <Pressable
                      style={styles.denyBtn}
                      onPress={() => denyMutation.mutate(item.id)}
                      testID={`deny-${item.id}`}
                    >
                      <Text style={styles.denyBtnText}>Deny</Text>
                    </Pressable>
                  </View>
                ) : null}
                {isPending ? (
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => deleteMutation.mutate(item.id)}
                    testID={`delete-${item.id}`}
                  >
                    <Text style={styles.deleteBtnText}>Withdraw</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Time Off Request</Text>

            <Text style={styles.inputLabel}>Start Date</Text>
            <View style={{ marginBottom: 14 }}>
              <DatePickerInput
                value={startDate}
                onChange={setStartDate}
                format="YYYY-MM-DD"
                testID="start-date-input"
              />
            </View>

            <Text style={styles.inputLabel}>End Date</Text>
            <View style={{ marginBottom: 14 }}>
              <DatePickerInput
                value={endDate}
                onChange={setEndDate}
                format="YYYY-MM-DD"
                testID="end-date-input"
              />
            </View>

            <Text style={styles.inputLabel}>Reason</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={reason}
              onChangeText={setReason}
              placeholder="Describe your reason for time off"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              testID="reason-input"
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                testID="cancel-button"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, (!startDate.trim() || !endDate.trim() || !reason.trim()) && styles.saveBtnDisabled]}
                onPress={() => createMutation.mutate({ startDate: startDate.trim(), endDate: endDate.trim(), reason: reason.trim() })}
                disabled={createMutation.isPending || !startDate.trim() || !endDate.trim() || !reason.trim()}
                testID="submit-button"
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Submit</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  addBtn: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#2b6cb0" },
  tabText: { fontSize: 14, fontWeight: "600", color: "#a0aec0" },
  tabTextActive: { color: "#2b6cb0" },
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#1a365d" },
  cardDates: { fontSize: 13, color: "#4a5568", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  reason: { fontSize: 13, color: "#718096", marginBottom: 8 },
  reviewedBy: { fontSize: 12, color: "#a0aec0", marginBottom: 8, fontStyle: "italic" },
  managerActions: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 4 },
  approveBtn: { flex: 1, backgroundColor: "#c6f6d5", borderRadius: 10, padding: 10, alignItems: "center" },
  approveBtnText: { fontSize: 13, fontWeight: "700", color: "#276749" },
  denyBtn: { flex: 1, backgroundColor: "#fed7d7", borderRadius: 10, padding: 10, alignItems: "center" },
  denyBtnText: { fontSize: 13, fontWeight: "700", color: "#c53030" },
  deleteBtn: { marginTop: 4, alignSelf: "flex-start" },
  deleteBtnText: { fontSize: 13, color: "#e53e3e", fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1a365d", marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#4a5568", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#f8fafc", color: "#1a202c", marginBottom: 14 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center", backgroundColor: "#f0f4f8" },
  cancelBtnText: { fontSize: 15, fontWeight: "700", color: "#4a5568" },
  saveBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center", backgroundColor: "#2b6cb0" },
  saveBtnDisabled: { backgroundColor: "#a0aec0" },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
