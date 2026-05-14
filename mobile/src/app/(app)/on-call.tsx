import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/api";
import { DatePickerInput } from "@/components/DatePickerInput";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScheduleWeek {
  tech: string;
  weekStart: Date;
  weekEnd: Date;
  isCurrent: boolean;
  isPast: boolean;
  cycleIndex: number; // which pass through the rotation (0-based)
  positionInCycle: number; // index within names[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun … 6=Sat
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7;
  d.setDate(d.getDate() + daysUntilMonday);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatShortDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

function computeSchedule(names: string[], startDate: string): ScheduleWeek[] {
  if (!names.length || !startDate) return [];

  const start = new Date(startDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const currentWeekOffset = Math.floor(
    (today.getTime() - start.getTime()) / msPerWeek
  );

  // Show 2 past weeks + 20 future weeks, capped so we don't show before startDate
  const displayStart = Math.max(0, currentWeekOffset - 2);
  const displayEnd = currentWeekOffset + 20;

  const weeks: ScheduleWeek[] = [];
  for (let i = displayStart; i <= displayEnd; i++) {
    const techIdx = ((i % names.length) + names.length) % names.length;
    const weekStart = new Date(start.getTime() + i * msPerWeek);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    weekEnd.setHours(23, 59, 59, 999);
    weeks.push({
      tech: names[techIdx],
      weekStart,
      weekEnd,
      isCurrent: i === currentWeekOffset,
      isPast: i < currentWeekOffset,
      cycleIndex: Math.floor(i / names.length),
      positionInCycle: techIdx,
    });
  }
  return weeks;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function OnCallScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [manageModalVisible, setManageModalVisible] = useState(false);

  // Manager check
  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => api.get<{ isManager: boolean }>("/api/time-off/my-profile"),
  });
  const isManager = profile?.isManager ?? false;

  // Rotation data
  const {
    data: rotation,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["on-call-rotation"],
    queryFn: async () => {
      const result = await api.get<{ names: string[]; startDate: string }>(
        "/api/on-call/rotation"
      );
      return result ?? { names: [], startDate: "" };
    },
  });

  const names = rotation?.names ?? [];
  const startDate = rotation?.startDate ?? "";
  const weeks = computeSchedule(names, startDate);
  const currentWeek = weeks.find((w) => w.isCurrent) ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="on-call-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          testID="back-button"
        >
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>On-Call Schedule</Text>
        {isManager ? (
          <Pressable
            onPress={() => setManageModalVisible(true)}
            style={styles.manageBtn}
            testID="manage-rotation-button"
          >
            <Text style={styles.manageBtnText}>Manage</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2c7a7b" />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      ) : (
        <FlatList
          data={weeks}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#2c7a7b"
            />
          }
          ListHeaderComponent={
            <>
              {/* Currently On Call Banner */}
              <View style={styles.banner} testID="current-oncall-banner">
                <Text style={styles.bannerLabel}>CURRENTLY ON CALL</Text>
                {currentWeek ? (
                  <>
                    <Text style={styles.bannerName}>{currentWeek.tech}</Text>
                    <Text style={styles.bannerDates}>
                      Week of Mon {formatShortDate(currentWeek.weekStart)} – Sun{" "}
                      {formatShortDate(currentWeek.weekEnd)}
                    </Text>
                  </>
                ) : names.length === 0 ? (
                  <Text style={styles.bannerEmpty}>No rotation configured</Text>
                ) : (
                  <Text style={styles.bannerEmpty}>
                    Schedule starts {startDate}
                  </Text>
                )}
              </View>

              {weeks.length > 0 ? (
                <Text style={styles.sectionLabel}>UPCOMING SCHEDULE</Text>
              ) : null}
            </>
          }
          ListEmptyComponent={
            names.length === 0 ? (
              <View style={styles.emptyState} testID="empty-state">
                <Text style={styles.emptyIcon}>📞</Text>
                <Text style={styles.emptyTitle}>No rotation yet</Text>
                <Text style={styles.emptyText}>
                  {isManager
                    ? "Tap Manage to set up the on-call rotation."
                    : "A manager needs to set up the on-call rotation."}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            // Check if this is the first item of a new cycle (after cycle 0)
            const prevItem = index > 0 ? weeks[index - 1] : null;
            const showRestartDivider =
              prevItem !== null &&
              item.cycleIndex > prevItem.cycleIndex &&
              item.cycleIndex > 0;

            return (
              <>
                {showRestartDivider ? (
                  <View style={styles.restartDivider}>
                    <View style={styles.restartLine} />
                    <Text style={styles.restartText}>Rotation restarts</Text>
                    <View style={styles.restartLine} />
                  </View>
                ) : null}
                <View
                  style={[
                    styles.weekCard,
                    item.isCurrent && styles.weekCardCurrent,
                    item.isPast && styles.weekCardPast,
                  ]}
                  testID={`week-row-${index}`}
                >
                  <View style={styles.weekCardLeft}>
                    {item.isCurrent ? (
                      <View style={styles.thisWeekBadge}>
                        <Text style={styles.thisWeekBadgeText}>THIS WEEK</Text>
                      </View>
                    ) : null}
                    <Text
                      style={[
                        styles.weekTechName,
                        item.isPast && styles.textMuted,
                      ]}
                    >
                      {item.tech}
                    </Text>
                  </View>
                  <View style={styles.weekCardRight}>
                    <Text
                      style={[
                        styles.weekDateRange,
                        item.isCurrent && styles.weekDateRangeCurrent,
                        item.isPast && styles.textMuted,
                      ]}
                    >
                      Mon {formatShortDate(item.weekStart)} – Sun{" "}
                      {formatShortDate(item.weekEnd)}
                    </Text>
                  </View>
                </View>
              </>
            );
          }}
        />
      )}

      {/* Manage Rotation Modal */}
      <ManageRotationModal
        visible={manageModalVisible}
        onClose={() => setManageModalVisible(false)}
        currentNames={names}
        currentStartDate={startDate}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["on-call-rotation"] });
          setManageModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Management Modal ─────────────────────────────────────────────────────────

interface ManageRotationModalProps {
  visible: boolean;
  onClose: () => void;
  currentNames: string[];
  currentStartDate: string;
  onSaved: () => void;
}

function ManageRotationModal({
  visible,
  onClose,
  currentNames,
  currentStartDate,
  onSaved,
}: ManageRotationModalProps) {
  const [names, setNames] = useState<string[]>(currentNames);
  const [startDate, setStartDate] = useState<string>(
    currentStartDate || nextMonday()
  );
  const [newName, setNewName] = useState<string>("");

  // Reset state whenever the modal opens with fresh data
  React.useEffect(() => {
    if (visible) {
      setNames(currentNames);
      setStartDate(currentStartDate || nextMonday());
      setNewName("");
    }
  }, [visible, currentNames, currentStartDate]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put<void>("/api/on-call/rotation", { names, startDate }),
    onSuccess: onSaved,
  });

  const handleAddName = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setNames((prev) => [...prev, trimmed]);
    setNewName("");
  };

  const handleRemoveName = (index: number) => {
    setNames((prev) => prev.filter((_, i) => i !== index));
  };

  const canSave = names.length > 0 && !!startDate;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      testID="manage-rotation-modal"
    >
      <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <Pressable
            onPress={onClose}
            style={styles.modalCancelBtn}
            testID="modal-cancel-button"
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Manage Rotation</Text>
          <Pressable
            onPress={() => saveMutation.mutate()}
            style={[styles.modalSaveBtn, !canSave && styles.modalSaveBtnDisabled]}
            disabled={saveMutation.isPending || !canSave}
            testID="modal-save-button"
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.modalSaveText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.modalBody}
          contentContainerStyle={styles.modalBodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Start Date */}
          <Text style={styles.sectionHeader}>ROTATION START DATE</Text>
          <Text style={styles.sectionHint}>Should be a Monday</Text>
          <DatePickerInput
            value={startDate}
            onChange={setStartDate}
            format="YYYY-MM-DD"
            placeholder="Select a Monday"
            testID="start-date-picker"
            label="Rotation Start Date (first Monday)"
            minDate="2020-01-01"
            maxDate="2030-12-31"
          />

          {/* Tech list */}
          <Text style={[styles.sectionHeader, { marginTop: 28 }]}>
            TECHNICIAN ORDER
          </Text>
          <Text style={styles.sectionHint}>
            Each tech takes one week in this order, then repeats.
          </Text>

          {names.length === 0 ? (
            <View style={styles.emptyNames}>
              <Text style={styles.emptyNamesText}>No technicians added yet.</Text>
            </View>
          ) : (
            names.map((name, idx) => (
              <View style={styles.nameRow} key={idx} testID={`name-row-${idx}`}>
                <View style={styles.nameRowIndex}>
                  <Text style={styles.nameRowIndexText}>{idx + 1}</Text>
                </View>
                <Text style={styles.nameRowText}>{name}</Text>
                <Pressable
                  onPress={() => handleRemoveName(idx)}
                  style={styles.removeBtn}
                  testID={`remove-name-${idx}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </Pressable>
              </View>
            ))
          )}

          {/* Add new name */}
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Technician name..."
              placeholderTextColor="#a0aec0"
              returnKeyType="done"
              onSubmitEditing={handleAddName}
              testID="new-name-input"
            />
            <Pressable
              onPress={handleAddName}
              style={[
                styles.addNameBtn,
                !newName.trim() && styles.addNameBtnDisabled,
              ]}
              disabled={!newName.trim()}
              testID="add-name-button"
            >
              <Text style={styles.addNameBtnText}>Add</Text>
            </Pressable>
          </View>

          {saveMutation.isError ? (
            <Text style={styles.errorText} testID="save-error">
              Failed to save. Please try again.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f0f4f8" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a365d",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { paddingRight: 12 },
  backText: { color: "#90cdf4", fontSize: 15, fontWeight: "600" },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  manageBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 60,
    alignItems: "center",
  },
  manageBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Loading
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#4a5568", fontSize: 15 },

  // List
  listContent: { padding: 16, gap: 0, paddingBottom: 32 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#718096",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },

  // Banner
  banner: {
    backgroundColor: "#2c7a7b",
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#2c7a7b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  bannerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  bannerName: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  bannerDates: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
  },
  bannerEmpty: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },

  // Empty state
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
    marginTop: 16,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a365d",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#718096",
    textAlign: "center",
    lineHeight: 22,
  },

  // Week cards
  weekCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  weekCardCurrent: {
    backgroundColor: "#e6f4f4",
    borderWidth: 1.5,
    borderColor: "#2c7a7b",
    shadowColor: "#2c7a7b",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  weekCardPast: { opacity: 0.5 },
  weekCardLeft: { flex: 1, gap: 4 },
  weekCardRight: { alignItems: "flex-end" },
  thisWeekBadge: {
    backgroundColor: "#2c7a7b",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  thisWeekBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.6,
  },
  weekTechName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a365d",
  },
  weekDateRange: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "500",
  },
  weekDateRangeCurrent: {
    color: "#2c7a7b",
    fontWeight: "600",
  },
  textMuted: { color: "#a0aec0" },

  // Rotation restart divider
  restartDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    gap: 8,
  },
  restartLine: { flex: 1, height: 1, backgroundColor: "#e2e8f0" },
  restartText: {
    fontSize: 12,
    color: "#a0aec0",
    fontWeight: "500",
  },

  // Modal
  modalSafe: { flex: 1, backgroundColor: "#f8fafc" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a365d",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalCancelBtn: { paddingVertical: 4, paddingHorizontal: 4, minWidth: 60 },
  modalCancelText: { color: "#90cdf4", fontSize: 15, fontWeight: "600" },
  modalTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  modalSaveBtn: {
    backgroundColor: "#2c7a7b",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  modalSaveBtnDisabled: { backgroundColor: "#a0aec0" },
  modalSaveText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 20, paddingBottom: 40 },

  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#718096",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: "#a0aec0",
    marginBottom: 10,
  },

  // Name list
  emptyNames: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  emptyNamesText: { fontSize: 14, color: "#a0aec0" },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  nameRowIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#ebf8ff",
    alignItems: "center",
    justifyContent: "center",
  },
  nameRowIndexText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2c7a7b",
  },
  nameRowText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1a365d" },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { fontSize: 13, color: "#e53e3e", fontWeight: "700" },

  // Add name
  addRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    alignItems: "center",
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#fff",
    color: "#1a202c",
  },
  addNameBtn: {
    backgroundColor: "#2c7a7b",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addNameBtnDisabled: { backgroundColor: "#a0aec0" },
  addNameBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  errorText: {
    marginTop: 14,
    fontSize: 14,
    color: "#e53e3e",
    textAlign: "center",
  },
});
