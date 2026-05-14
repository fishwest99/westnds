import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, RefreshControl, TextInput, Modal, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/api";

type OnCallEntry = {
  id: string;
  techName: string;
  date: string;
  notes: string;
  createdAt: string;
};

export default function OnCallScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["on-call"],
    queryFn: () => api.get<OnCallEntry[]>("/api/on-call"),
  });

  const createMutation = useMutation({
    mutationFn: (entry: { techName: string; date: string; notes: string }) =>
      api.post<OnCallEntry>("/api/on-call", entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["on-call"] });
      setModalVisible(false);
      setEditDate("");
      setEditName("");
      setEditNotes("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/on-call/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["on-call"] }),
  });

  const entries = data ?? [];

  const handleSave = () => {
    if (!editDate.trim() || !editName.trim()) return;
    createMutation.mutate({ techName: editName.trim(), date: editDate.trim(), notes: editNotes.trim() });
  };

  const openAdd = () => {
    setEditDate("");
    setEditName("");
    setEditNotes("");
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="on-call-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>On-Call Schedule</Text>
        <Pressable onPress={openAdd} style={styles.addBtn} testID="add-entry-button">
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2b6cb0" />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={entries.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2b6cb0" />
          }
          ListHeaderComponent={
            <Text style={styles.listLabel}>Upcoming On-Call Assignments</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyState} testID="empty-state">
              <Text style={styles.emptyIcon}>📞</Text>
              <Text style={styles.emptyTitle}>No schedule yet</Text>
              <Text style={styles.emptyText}>Managers can add on-call assignments using the + Add button above.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`on-call-item-${item.id}`}>
              <View style={styles.cardLeft}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateText}>{item.date}</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.techName}>{item.techName}</Text>
                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
              </View>
              <Pressable
                onPress={() => deleteMutation.mutate(item.id)}
                style={styles.deleteBtn}
                testID={`delete-entry-${item.id}`}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </Pressable>
            </View>
          )}
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
            <Text style={styles.modalTitle}>Add On-Call Entry</Text>

            <Text style={styles.inputLabel}>Date (e.g. 2025-01-15)</Text>
            <TextInput
              style={styles.input}
              value={editDate}
              onChangeText={setEditDate}
              placeholder="YYYY-MM-DD"
              testID="date-input"
            />

            <Text style={styles.inputLabel}>Technician Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Full name"
              testID="tech-name-input"
            />

            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Any notes..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              testID="notes-input"
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
                style={[styles.saveBtn, (!editDate.trim() || !editName.trim()) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={createMutation.isPending || !editDate.trim() || !editName.trim()}
                testID="save-button"
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
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
  addBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#4a5568", fontSize: 15 },
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1 },
  listLabel: { fontSize: 13, fontWeight: "700", color: "#718096", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1a365d", marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#718096", textAlign: "center", lineHeight: 22 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: { marginRight: 14 },
  dateBox: {
    backgroundColor: "#ebf4ff",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 90,
  },
  dateText: { fontSize: 13, fontWeight: "700", color: "#2b6cb0" },
  cardRight: { flex: 1 },
  techName: { fontSize: 16, fontWeight: "700", color: "#1a365d" },
  notes: { fontSize: 13, color: "#718096", marginTop: 2 },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: { color: "#e53e3e", fontSize: 16, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1a365d", marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#4a5568", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#f8fafc",
    color: "#1a202c",
    marginBottom: 14,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#f0f4f8",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "700", color: "#4a5568" },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#2b6cb0",
  },
  saveBtnDisabled: { backgroundColor: "#a0aec0" },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
