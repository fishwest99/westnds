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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/api";
import { useSession } from "@/lib/auth/use-session";

type WorkEntry = {
  id: string;
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  travelMinutes: number;
  notes: string;
  createdAt: string;
};

type SummaryData = {
  periodLabel: string;
  totalWorkedMinutes: number;
  totalTravelMinutes: number;
  entryCount: number;
  entries: WorkEntry[];
};

type StaffMemberSummary = {
  userId: string;
  userName: string;
  totalWorkedMinutes: number;
  totalTravelMinutes: number;
  entryCount: number;
  entries: WorkEntry[];
};

type StaffOverviewData = {
  periodLabel: string;
  staff: StaffMemberSummary[];
};

type ImportableBillingForm = {
  id: string;
  patientName: string;
  facility: string;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: string;
  drivingTime: string;
};

type Period = "day" | "week" | "month" | "year";

const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const formatMinutes = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const getTodayString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
};

const computeWorkedMinutes = (startTime: string, endTime: string): number => {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  return Math.max(0, endTotal - startTotal);
};

const EMPTY_FORM = {
  facilityName: "",
  date: getTodayString(),
  startTime: "",
  endTime: "",
  travelMinutes: "",
  notes: "",
};

const OWNER_EMAIL = "west_nds@yahoo.com";

export default function TimeTrackingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("week");
  const today = getTodayString();

  const { data: session } = useSession();
  const isOwner = (session?.user?.email ?? "") === OWNER_EMAIL;

  // View toggle state (owner only)
  const [view, setView] = useState<"mine" | "staff">("mine");

  // Expanded staff member state
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Add modal state
  const [addVisible, setAddVisible] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Edit modal state
  const [editVisible, setEditVisible] = useState(false);
  const [editEntry, setEditEntry] = useState<WorkEntry | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  // Import from billing sheets state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importableForms, setImportableForms] = useState<ImportableBillingForm[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
  const [loadingImportable, setLoadingImportable] = useState(false);
  const [importing, setImporting] = useState(false);

  // Summary query (my hours)
  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
    isRefetching: summaryRefetching,
  } = useQuery({
    queryKey: ["work-entries-summary", period, today],
    queryFn: () =>
      api.get<SummaryData>(
        `/api/work-entries/summary?period=${period}&referenceDate=${today}`
      ),
  });

  // Staff overview query (owner only)
  const {
    data: staffOverview,
    isLoading: staffLoading,
    refetch: refetchStaff,
    isRefetching: staffRefetching,
  } = useQuery({
    queryKey: ["work-entries-staff", period, today],
    queryFn: () =>
      api.get<StaffOverviewData>(
        `/api/work-entries/staff-overview?period=${period}&referenceDate=${today}`
      ),
    enabled: isOwner && view === "staff",
  });

  const entries: WorkEntry[] = summary?.entries ?? [];

  const createMutation = useMutation({
    mutationFn: (body: {
      facilityName: string;
      date: string;
      startTime: string;
      endTime: string;
      travelMinutes: number;
      notes: string;
    }) => api.post<WorkEntry>("/api/work-entries", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-entries-summary"] });
      setAddVisible(false);
      setForm({ ...EMPTY_FORM });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: {
        facilityName: string;
        date: string;
        startTime: string;
        endTime: string;
        travelMinutes: number;
        notes: string;
      };
    }) => api.put<WorkEntry>(`/api/work-entries/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-entries-summary"] });
      setEditVisible(false);
      setEditEntry(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/work-entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-entries-summary"] });
      setEditVisible(false);
      setEditEntry(null);
    },
  });

  const openEdit = (entry: WorkEntry) => {
    setEditEntry(entry);
    setEditForm({
      facilityName: entry.facilityName,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      travelMinutes: String(entry.travelMinutes),
      notes: entry.notes ?? "",
    });
    setEditVisible(true);
  };

  const handleCreate = () => {
    createMutation.mutate({
      facilityName: form.facilityName.trim(),
      date: form.date.trim(),
      startTime: form.startTime.trim(),
      endTime: form.endTime.trim(),
      travelMinutes: parseInt(form.travelMinutes || "0", 10),
      notes: form.notes.trim(),
    });
  };

  const handleUpdate = () => {
    if (!editEntry) return;
    updateMutation.mutate({
      id: editEntry.id,
      body: {
        facilityName: editForm.facilityName.trim(),
        date: editForm.date.trim(),
        startTime: editForm.startTime.trim(),
        endTime: editForm.endTime.trim(),
        travelMinutes: parseInt(editForm.travelMinutes || "0", 10),
        notes: editForm.notes.trim(),
      },
    });
  };

  const isAddValid =
    form.facilityName.trim().length > 0 &&
    form.date.trim().length > 0 &&
    form.startTime.trim().length > 0 &&
    form.endTime.trim().length > 0;

  const isEditValid =
    editForm.facilityName.trim().length > 0 &&
    editForm.date.trim().length > 0 &&
    editForm.startTime.trim().length > 0 &&
    editForm.endTime.trim().length > 0;

  const openImportModal = async () => {
    setLoadingImportable(true);
    setShowImportModal(true);
    setSelectedImportIds(new Set());
    try {
      const result = await api.get<ImportableBillingForm[]>("/api/work-entries/importable-billing-forms");
      setImportableForms(result ?? []);
    } finally {
      setLoadingImportable(false);
    }
  };

  const handleImport = async () => {
    if (selectedImportIds.size === 0) return;
    setImporting(true);
    try {
      await api.post<{ imported: number }>("/api/work-entries/import-from-billing", {
        billingFormIds: Array.from(selectedImportIds),
      });
      queryClient.invalidateQueries({ queryKey: ["work-entries"] });
      queryClient.invalidateQueries({ queryKey: ["work-summary"] });
      setShowImportModal(false);
      setImportableForms([]);
      setSelectedImportIds(new Set());
    } finally {
      setImporting(false);
    }
  };

  // Computed staff totals
  const staffList: StaffMemberSummary[] = staffOverview?.staff ?? [];
  const staffTotalWorked = staffList.reduce((sum, s) => sum + s.totalWorkedMinutes, 0);
  const staffTotalTravel = staffList.reduce((sum, s) => sum + s.totalTravelMinutes, 0);
  const staffTotalEntries = staffList.reduce((sum, s) => sum + s.entryCount, 0);

  const renderStaffView = () => {
    if (staffLoading) {
      return (
        <View style={styles.centered} testID="staff-loading-indicator">
          <ActivityIndicator size="large" color="#2c7a7b" />
          <Text style={styles.loadingText}>Loading staff hours...</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={staffList}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={
          staffList.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={staffRefetching}
            onRefresh={refetchStaff}
            tintColor="#2c7a7b"
          />
        }
        testID="staff-list"
        ListHeaderComponent={
          <View style={styles.summaryCard} testID="staff-summary-card">
            <Text style={styles.summaryPeriodLabel}>
              {staffOverview?.periodLabel ?? ""}
            </Text>
            <Text style={styles.summaryHours}>
              {formatMinutes(staffTotalWorked)}
            </Text>
            <Text style={styles.summaryHoursLabel}>total worked (all staff)</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryMetricValue}>
                  {formatMinutes(staffTotalTravel)}
                </Text>
                <Text style={styles.summaryMetricLabel}>Travel</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryMetricValue}>
                  {staffTotalEntries}
                </Text>
                <Text style={styles.summaryMetricLabel}>
                  {staffTotalEntries === 1 ? "Entry" : "Entries"}
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState} testID="staff-empty-state">
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No hours logged this period</Text>
            <Text style={styles.emptyText}>
              No staff have logged hours for this period.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = expandedUserId === item.userId;
          return (
            <View style={styles.staffCard} testID={`staff-card-${item.userId}`}>
              <Pressable
                onPress={() =>
                  setExpandedUserId(isExpanded ? null : item.userId)
                }
                testID={`staff-card-toggle-${item.userId}`}
              >
                <View style={styles.staffCardTop}>
                  <Text style={styles.staffName}>{item.userName}</Text>
                  <Text style={styles.staffHours}>
                    {formatMinutes(item.totalWorkedMinutes)}
                  </Text>
                </View>
                <Text style={styles.staffMeta}>
                  {item.entryCount} {item.entryCount === 1 ? "entry" : "entries"} · {formatMinutes(item.totalTravelMinutes)} travel
                </Text>
                <Text style={styles.staffChevron}>{isExpanded ? "▼" : "▶"}</Text>
              </Pressable>

              {isExpanded
                ? item.entries.map((entry) => {
                    const worked = computeWorkedMinutes(entry.startTime, entry.endTime);
                    return (
                      <View
                        key={entry.id}
                        style={styles.subEntry}
                        testID={`sub-entry-${entry.id}`}
                      >
                        <View style={styles.subEntryTop}>
                          <Text style={styles.subEntryFacility}>{entry.facilityName}</Text>
                          <Text style={styles.subEntryHours}>{formatMinutes(worked)}</Text>
                        </View>
                        <Text style={styles.subEntryDate}>{entry.date}</Text>
                        <Text style={styles.subEntryTime}>
                          {entry.startTime} – {entry.endTime}
                        </Text>
                        {entry.travelMinutes > 0 ? (
                          <View style={[styles.travelBadge, { marginTop: 6, alignSelf: "flex-start" }]}>
                            <Text style={styles.travelBadgeText}>
                              {formatMinutes(entry.travelMinutes)} travel
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                : null}
            </View>
          );
        }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="time-tracking-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Time Tracking</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Period tabs */}
      <View style={styles.periodTabs} testID="period-tabs">
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.periodTab, period === p.key && styles.periodTabActive]}
            onPress={() => setPeriod(p.key)}
            testID={`period-tab-${p.key}`}
          >
            <Text
              style={[styles.periodTabText, period === p.key && styles.periodTabTextActive]}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* View toggle (owner only) */}
      {isOwner ? (
        <View style={styles.viewToggle} testID="view-toggle">
          <Pressable
            style={[styles.viewToggleBtn, view === "mine" && styles.viewToggleBtnActive]}
            onPress={() => setView("mine")}
            testID="view-toggle-mine"
          >
            <Text
              style={[styles.viewToggleText, view === "mine" && styles.viewToggleTextActive]}
            >
              My Hours
            </Text>
          </Pressable>
          <Pressable
            style={[styles.viewToggleBtn, view === "staff" && styles.viewToggleBtnActive]}
            onPress={() => setView("staff")}
            testID="view-toggle-staff"
          >
            <Text
              style={[styles.viewToggleText, view === "staff" && styles.viewToggleTextActive]}
            >
              Staff Hours
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Content */}
      {isOwner && view === "staff" ? (
        renderStaffView()
      ) : summaryLoading ? (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2c7a7b" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            entries.length === 0 ? styles.emptyContainer : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={summaryRefetching}
              onRefresh={refetchSummary}
              tintColor="#2c7a7b"
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.summaryCard} testID="summary-card">
                <Text style={styles.summaryPeriodLabel}>
                  {summary?.periodLabel ?? ""}
                </Text>
                <Text style={styles.summaryHours}>
                  {formatMinutes(summary?.totalWorkedMinutes ?? 0)}
                </Text>
                <Text style={styles.summaryHoursLabel}>worked</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryMetric}>
                    <Text style={styles.summaryMetricValue}>
                      {formatMinutes(summary?.totalTravelMinutes ?? 0)}
                    </Text>
                    <Text style={styles.summaryMetricLabel}>Travel</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryMetric}>
                    <Text style={styles.summaryMetricValue}>
                      {summary?.entryCount ?? 0}
                    </Text>
                    <Text style={styles.summaryMetricLabel}>
                      {summary?.entryCount === 1 ? "Entry" : "Entries"}
                    </Text>
                  </View>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [importStyles.importBanner, pressed && { opacity: 0.85 }]}
                onPress={openImportModal}
                testID="import-billing-button"
              >
                <View style={importStyles.importBannerLeft}>
                  <Text style={importStyles.importBannerIcon}>📋</Text>
                  <View>
                    <Text style={importStyles.importBannerTitle}>Import from Billing Sheets</Text>
                    <Text style={importStyles.importBannerSub}>Pull hours & driving time automatically</Text>
                  </View>
                </View>
                <Text style={importStyles.importBannerArrow}>→</Text>
              </Pressable>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyState} testID="empty-state">
              <Text style={styles.emptyIcon}>⏱</Text>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptyText}>
                Tap the + button to log your first shift.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const worked = computeWorkedMinutes(item.startTime, item.endTime);
            return (
              <Pressable
                style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
                onPress={() => openEdit(item)}
                testID={`entry-item-${item.id}`}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardFacility}>{item.facilityName}</Text>
                  <Text style={styles.cardWorked}>{formatMinutes(worked)}</Text>
                </View>
                <Text style={styles.cardDate}>{item.date}</Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.cardTime}>
                    {item.startTime} – {item.endTime}
                  </Text>
                  {item.travelMinutes > 0 ? (
                    <View style={styles.travelBadge}>
                      <Text style={styles.travelBadgeText}>
                        {formatMinutes(item.travelMinutes)} travel
                      </Text>
                    </View>
                  ) : null}
                </View>
                {item.notes ? (
                  <Text style={styles.cardNotes} numberOfLines={1}>
                    {item.notes}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}

      {/* Floating add button — only in "mine" view */}
      {view === "mine" ? (
        <Pressable
          style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => {
            setForm({ ...EMPTY_FORM, date: getTodayString() });
            setAddVisible(true);
          }}
          testID="add-entry-button"
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}

      {/* Add Modal */}
      <Modal
        visible={addVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalWrapper}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setAddVisible(false)} />
          <View style={styles.modalCard} testID="add-modal">
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Log Hours</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Facility Name</Text>
              <TextInput
                style={styles.input}
                value={form.facilityName}
                onChangeText={(v) => setForm((f) => ({ ...f, facilityName: v }))}
                placeholder="e.g. St. Mary's Hospital"
                placeholderTextColor="#a0aec0"
                testID="facility-name-input"
              />

              <Text style={styles.inputLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={form.date}
                onChangeText={(v) => setForm((f) => ({ ...f, date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#a0aec0"
                testID="date-input"
              />

              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>Start Time</Text>
                  <TextInput
                    style={styles.input}
                    value={form.startTime}
                    onChangeText={(v) => setForm((f) => ({ ...f, startTime: v }))}
                    placeholder="08:00"
                    placeholderTextColor="#a0aec0"
                    testID="start-time-input"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>End Time</Text>
                  <TextInput
                    style={styles.input}
                    value={form.endTime}
                    onChangeText={(v) => setForm((f) => ({ ...f, endTime: v }))}
                    placeholder="16:00"
                    placeholderTextColor="#a0aec0"
                    testID="end-time-input"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Travel Time (minutes)</Text>
              <TextInput
                style={styles.input}
                value={form.travelMinutes}
                onChangeText={(v) => setForm((f) => ({ ...f, travelMinutes: v }))}
                placeholder="0"
                placeholderTextColor="#a0aec0"
                keyboardType="numeric"
                testID="travel-minutes-input"
              />

              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.notes}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Any additional notes..."
                placeholderTextColor="#a0aec0"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                testID="notes-input"
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setAddVisible(false)}
                  testID="cancel-add-button"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveBtn, !isAddValid && styles.saveBtnDisabled]}
                  onPress={handleCreate}
                  disabled={createMutation.isPending || !isAddValid}
                  testID="save-add-button"
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Import from Billing Modal */}
      <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
        <View style={importStyles.modalOverlay}>
          <View style={importStyles.modalCard}>
            <View style={importStyles.modalHeader}>
              <Text style={importStyles.modalTitle}>Import from Billing Sheets</Text>
              <Pressable onPress={() => setShowImportModal(false)} testID="close-import-modal">
                <Text style={importStyles.modalClose}>✕</Text>
              </Pressable>
            </View>

            {loadingImportable ? (
              <View style={importStyles.centered}>
                <ActivityIndicator size="large" color="#2c7a7b" />
                <Text style={importStyles.loadingText}>Loading billing sheets...</Text>
              </View>
            ) : importableForms.length === 0 ? (
              <View style={importStyles.centered}>
                <Text style={importStyles.emptyIcon}>✓</Text>
                <Text style={importStyles.emptyText}>All submitted billing sheets have been imported.</Text>
              </View>
            ) : (
              <>
                <Pressable
                  style={importStyles.selectAllBtn}
                  onPress={() => {
                    if (selectedImportIds.size === importableForms.length) {
                      setSelectedImportIds(new Set());
                    } else {
                      setSelectedImportIds(new Set(importableForms.map((f) => f.id)));
                    }
                  }}
                >
                  <Text style={importStyles.selectAllText}>
                    {selectedImportIds.size === importableForms.length ? "Deselect All" : "Select All"}
                  </Text>
                </Pressable>

                <ScrollView style={importStyles.formList} showsVerticalScrollIndicator={false}>
                  {importableForms.map((form) => {
                    const isSelected = selectedImportIds.has(form.id);
                    const drivingMins = parseInt(form.drivingTime || "0", 10);
                    return (
                      <Pressable
                        key={form.id}
                        style={[importStyles.formRow, isSelected && importStyles.formRowSelected]}
                        onPress={() => {
                          const next = new Set(selectedImportIds);
                          if (isSelected) next.delete(form.id);
                          else next.add(form.id);
                          setSelectedImportIds(next);
                        }}
                      >
                        <View style={[importStyles.checkbox, isSelected && importStyles.checkboxSelected]}>
                          {isSelected ? <Text style={importStyles.checkmark}>✓</Text> : null}
                        </View>
                        <View style={importStyles.formRowContent}>
                          <Text style={importStyles.formPatient}>{form.patientName || "Unknown Patient"}</Text>
                          <Text style={importStyles.formFacility}>{form.facility || "No facility"}</Text>
                          <View style={importStyles.formMeta}>
                            <Text style={importStyles.formMetaText}>{form.date}</Text>
                            <Text style={importStyles.formMetaDot}>·</Text>
                            <Text style={importStyles.formMetaText}>{form.startTime} – {form.endTime}</Text>
                            {form.totalHours ? <><Text style={importStyles.formMetaDot}>·</Text><Text style={importStyles.formMetaText}>{form.totalHours}h</Text></> : null}
                            {drivingMins > 0 ? <><Text style={importStyles.formMetaDot}>·</Text><Text style={importStyles.formMetaDriving}>🚗 {drivingMins}min</Text></> : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Pressable
                  style={[importStyles.importBtn, selectedImportIds.size === 0 && importStyles.importBtnDisabled]}
                  onPress={handleImport}
                  disabled={importing || selectedImportIds.size === 0}
                  testID="confirm-import-button"
                >
                  {importing
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={importStyles.importBtnText}>
                        Import {selectedImportIds.size > 0 ? `${selectedImportIds.size} ` : ""}
                        {selectedImportIds.size === 1 ? "Entry" : "Entries"}
                      </Text>}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalWrapper}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setEditVisible(false)} />
          <View style={styles.modalCard} testID="edit-modal">
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Entry</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Facility Name</Text>
              <TextInput
                style={styles.input}
                value={editForm.facilityName}
                onChangeText={(v) => setEditForm((f) => ({ ...f, facilityName: v }))}
                placeholder="e.g. St. Mary's Hospital"
                placeholderTextColor="#a0aec0"
                testID="edit-facility-name-input"
              />

              <Text style={styles.inputLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={editForm.date}
                onChangeText={(v) => setEditForm((f) => ({ ...f, date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#a0aec0"
                testID="edit-date-input"
              />

              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>Start Time</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.startTime}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, startTime: v }))}
                    placeholder="08:00"
                    placeholderTextColor="#a0aec0"
                    testID="edit-start-time-input"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>End Time</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.endTime}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, endTime: v }))}
                    placeholder="16:00"
                    placeholderTextColor="#a0aec0"
                    testID="edit-end-time-input"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Travel Time (minutes)</Text>
              <TextInput
                style={styles.input}
                value={editForm.travelMinutes}
                onChangeText={(v) => setEditForm((f) => ({ ...f, travelMinutes: v }))}
                placeholder="0"
                placeholderTextColor="#a0aec0"
                keyboardType="numeric"
                testID="edit-travel-minutes-input"
              />

              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editForm.notes}
                onChangeText={(v) => setEditForm((f) => ({ ...f, notes: v }))}
                placeholder="Any additional notes..."
                placeholderTextColor="#a0aec0"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                testID="edit-notes-input"
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setEditVisible(false)}
                  testID="cancel-edit-button"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveBtn, !isEditValid && styles.saveBtnDisabled]}
                  onPress={handleUpdate}
                  disabled={updateMutation.isPending || !isEditValid}
                  testID="save-edit-button"
                >
                  {updateMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </Pressable>
              </View>

              <Pressable
                style={styles.deleteBtn}
                onPress={() => editEntry && deleteMutation.mutate(editEntry.id)}
                disabled={deleteMutation.isPending}
                testID="delete-entry-button"
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator color="#e53e3e" size="small" />
                ) : (
                  <Text style={styles.deleteBtnText}>Delete Entry</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  backBtn: { width: 60 },
  backText: { color: "#90cdf4", fontSize: 15, fontWeight: "600" },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  periodTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  periodTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  periodTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#2c7a7b",
  },
  periodTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#a0aec0",
  },
  periodTabTextActive: { color: "#2c7a7b" },

  viewToggle: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  viewToggleBtn: { flex: 1, paddingVertical: 11, alignItems: "center" },
  viewToggleBtnActive: { borderBottomWidth: 2, borderBottomColor: "#2c7a7b" },
  viewToggleText: { fontSize: 14, fontWeight: "600", color: "#a0aec0" },
  viewToggleTextActive: { color: "#2c7a7b" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#4a5568", fontSize: 15 },

  listContent: { padding: 16, gap: 12, paddingBottom: 100 },
  emptyContainer: { flexGrow: 1 },

  summaryCard: {
    backgroundColor: "#2c7a7b",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#2c7a7b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  summaryPeriodLabel: {
    fontSize: 13,
    color: "#b2f5ea",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  summaryHours: {
    fontSize: 52,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 60,
  },
  summaryHoursLabel: {
    fontSize: 14,
    color: "#81e6d9",
    marginBottom: 20,
    fontWeight: "500",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 24,
  },
  summaryMetric: { alignItems: "center" },
  summaryMetricValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  summaryMetricLabel: {
    fontSize: 12,
    color: "#81e6d9",
    marginTop: 2,
    fontWeight: "500",
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.3)",
  },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
    marginTop: 32,
  },
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
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  cardFacility: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a365d",
    flex: 1,
    marginRight: 8,
  },
  cardWorked: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2c7a7b",
  },
  cardDate: {
    fontSize: 12,
    color: "#a0aec0",
    marginBottom: 8,
    fontWeight: "500",
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTime: { fontSize: 13, color: "#4a5568", fontWeight: "500" },
  travelBadge: {
    backgroundColor: "#e6fffa",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  travelBadgeText: { fontSize: 11, fontWeight: "700", color: "#2c7a7b" },
  cardNotes: {
    fontSize: 12,
    color: "#718096",
    marginTop: 6,
    fontStyle: "italic",
  },

  staffCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  staffCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  staffName: { fontSize: 16, fontWeight: "700", color: "#1a365d" },
  staffHours: { fontSize: 16, fontWeight: "800", color: "#2c7a7b" },
  staffMeta: { fontSize: 13, color: "#718096" },
  staffChevron: { fontSize: 14, color: "#a0aec0", marginTop: 6, textAlign: "right" },
  subEntry: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  subEntryTop: { flexDirection: "row", justifyContent: "space-between" },
  subEntryFacility: { fontSize: 14, fontWeight: "600", color: "#1a365d" },
  subEntryHours: { fontSize: 14, fontWeight: "700", color: "#2c7a7b" },
  subEntryDate: { fontSize: 12, color: "#a0aec0", marginTop: 2 },
  subEntryTime: { fontSize: 12, color: "#4a5568", marginTop: 2 },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2c7a7b",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2c7a7b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 },

  modalWrapper: { flex: 1, justifyContent: "flex-end" },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1a365d",
    marginBottom: 20,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4a5568",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
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

  row: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1 },

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
    backgroundColor: "#2c7a7b",
  },
  saveBtnDisabled: { backgroundColor: "#a0aec0" },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  deleteBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#fed7d7",
  },
  deleteBtnText: { fontSize: 15, fontWeight: "700", color: "#e53e3e" },
});

const importStyles = StyleSheet.create({
  importBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#e6fffa", borderRadius: 14, padding: 14, marginHorizontal: 16,
    marginBottom: 12, borderWidth: 1, borderColor: "#81e6d9",
  },
  importBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  importBannerIcon: { fontSize: 22 },
  importBannerTitle: { fontSize: 14, fontWeight: "700", color: "#2c7a7b" },
  importBannerSub: { fontSize: 12, color: "#4a5568", marginTop: 1 },
  importBannerArrow: { fontSize: 16, color: "#2c7a7b", fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "85%",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1a202c" },
  modalClose: { fontSize: 18, color: "#718096", fontWeight: "600" },
  centered: { alignItems: "center", paddingVertical: 32 },
  loadingText: { marginTop: 12, color: "#4a5568", fontSize: 15 },
  emptyIcon: { fontSize: 32, color: "#276749", marginBottom: 8 },
  emptyText: { fontSize: 15, color: "#4a5568", textAlign: "center", lineHeight: 22 },
  selectAllBtn: { alignSelf: "flex-end", marginBottom: 10 },
  selectAllText: { fontSize: 13, color: "#2c7a7b", fontWeight: "600" },
  formList: { maxHeight: 360 },
  formRow: {
    flexDirection: "row", alignItems: "flex-start", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f0f4f8", gap: 12,
  },
  formRowSelected: { backgroundColor: "#e6fffa", borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#cbd5e0",
    justifyContent: "center", alignItems: "center", marginTop: 2, flexShrink: 0,
  },
  checkboxSelected: { backgroundColor: "#2c7a7b", borderColor: "#2c7a7b" },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  formRowContent: { flex: 1 },
  formPatient: { fontSize: 15, fontWeight: "700", color: "#1a202c", marginBottom: 2 },
  formFacility: { fontSize: 13, color: "#4a5568", marginBottom: 4 },
  formMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  formMetaText: { fontSize: 12, color: "#718096" },
  formMetaDot: { fontSize: 12, color: "#cbd5e0" },
  formMetaDriving: { fontSize: 12, color: "#c05621", fontWeight: "600" },
  importBtn: {
    backgroundColor: "#2c7a7b", borderRadius: 12, padding: 16,
    alignItems: "center", marginTop: 16,
  },
  importBtnDisabled: { backgroundColor: "#a0aec0" },
  importBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
