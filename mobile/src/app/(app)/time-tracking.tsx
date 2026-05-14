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
import { DatePickerInput } from "@/components/DatePickerInput";

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

type MissedHoursRequest = {
  id: string;
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  travelMinutes: number;
  notes: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  user: { name: string; email: string };
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

const EMPTY_REQUEST_FORM = {
  facilityName: "",
  date: getTodayString(),
  startTime: "",
  endTime: "",
  travelMinutes: "",
  notes: "",
  reason: "",
};

const fmtDate = (d: string) => {
  if (!d) return d;
  if (d.includes('/')) return d;
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
};

const OWNER_EMAIL = "west_nds@yahoo.com";

export default function TimeTrackingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("week");
  const today = getTodayString();

  const { data: session } = useSession();
  const isOwner = (session?.user?.email ?? "") === OWNER_EMAIL;

  // Fetch profile to get isManager flag
  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () =>
      api.get<{ isManager: boolean; isOwner: boolean; roleLabel: string }>(
        "/api/time-off/my-profile"
      ),
    staleTime: 1000 * 60 * 5,
  });

  const isManager = profile?.isManager ?? isOwner;

  // View toggle state (manager/owner only): "mine" | "staff" | "pending-requests"
  const [view, setView] = useState<"mine" | "staff" | "pending-requests">("mine");

  // Expanded staff member state
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Add modal state (manager only)
  const [addVisible, setAddVisible] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Edit modal state (manager only)
  const [editVisible, setEditVisible] = useState(false);
  const [editEntry, setEditEntry] = useState<WorkEntry | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  // Missed hours request modal (technician only)
  const [requestVisible, setRequestVisible] = useState(false);
  const [requestForm, setRequestForm] = useState({ ...EMPTY_REQUEST_FORM });

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

  // Staff overview query (manager only)
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
    enabled: isManager && view === "staff",
  });

  // My missed hours requests (technician)
  const {
    data: myRequests,
    isLoading: myRequestsLoading,
    refetch: refetchMyRequests,
    isRefetching: myRequestsRefetching,
  } = useQuery({
    queryKey: ["missed-hours-requests-mine"],
    queryFn: () =>
      api.get<MissedHoursRequest[]>("/api/missed-hours-requests/my-requests"),
    enabled: !isManager,
  });

  // Pending missed hours requests (manager only)
  const {
    data: pendingRequests,
    isLoading: pendingRequestsLoading,
    refetch: refetchPending,
    isRefetching: pendingRefetching,
  } = useQuery({
    queryKey: ["missed-hours-requests-pending"],
    queryFn: () =>
      api.get<MissedHoursRequest[]>("/api/missed-hours-requests/pending"),
    enabled: isManager && view === "pending-requests",
  });

  const pendingCount = pendingRequests?.length ?? 0;

  const entries: WorkEntry[] = summary?.entries ?? [];
  const myRequestsList: MissedHoursRequest[] = myRequests ?? [];

  // Manager mutations
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

  // Technician: submit missed hours request
  const submitRequestMutation = useMutation({
    mutationFn: (body: {
      facilityName: string;
      date: string;
      startTime: string;
      endTime: string;
      travelMinutes: number;
      notes: string;
      reason: string;
    }) => api.post<MissedHoursRequest>("/api/missed-hours-requests", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missed-hours-requests-mine"] });
      setRequestVisible(false);
      setRequestForm({ ...EMPTY_REQUEST_FORM });
    },
  });

  // Manager: approve / deny
  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      api.put<MissedHoursRequest>(`/api/missed-hours-requests/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missed-hours-requests-pending"] });
    },
  });

  const denyMutation = useMutation({
    mutationFn: (id: string) =>
      api.put<MissedHoursRequest>(`/api/missed-hours-requests/${id}/deny`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missed-hours-requests-pending"] });
    },
  });

  const openEdit = (entry: WorkEntry) => {
    if (!isManager) return;
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

  const handleSubmitRequest = () => {
    submitRequestMutation.mutate({
      facilityName: requestForm.facilityName.trim(),
      date: requestForm.date.trim(),
      startTime: requestForm.startTime.trim(),
      endTime: requestForm.endTime.trim(),
      travelMinutes: parseInt(requestForm.travelMinutes || "0", 10),
      notes: requestForm.notes.trim(),
      reason: requestForm.reason.trim(),
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

  const isRequestValid =
    requestForm.facilityName.trim().length > 0 &&
    requestForm.date.trim().length > 0 &&
    requestForm.startTime.trim().length > 0 &&
    requestForm.endTime.trim().length > 0 &&
    requestForm.reason.trim().length > 0;

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
                        <Text style={styles.subEntryDate}>{fmtDate(entry.date)}</Text>
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

  const renderPendingRequestsView = () => {
    if (pendingRequestsLoading) {
      return (
        <View style={styles.centered} testID="pending-requests-loading">
          <ActivityIndicator size="large" color="#2c7a7b" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      );
    }

    const requests: MissedHoursRequest[] = pendingRequests ?? [];

    return (
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          requests.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={pendingRefetching}
            onRefresh={refetchPending}
            tintColor="#2c7a7b"
          />
        }
        testID="pending-requests-list"
        ListEmptyComponent={
          <View style={styles.emptyState} testID="pending-requests-empty">
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyText}>
              No pending missed hours requests to review.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const worked = computeWorkedMinutes(item.startTime, item.endTime);
          const isApproving = approveMutation.isPending && approveMutation.variables === item.id;
          const isDenying = denyMutation.isPending && denyMutation.variables === item.id;
          return (
            <View style={requestStyles.card} testID={`pending-request-${item.id}`}>
              <View style={requestStyles.cardHeader}>
                <Text style={requestStyles.techName}>{item.user.name}</Text>
                <View style={[requestStyles.badge, requestStyles.badgePending]}>
                  <Text style={[requestStyles.badgeText, requestStyles.badgeTextPending]}>Pending</Text>
                </View>
              </View>

              <Text style={requestStyles.facility}>{item.facilityName}</Text>

              <View style={requestStyles.metaRow}>
                <Text style={requestStyles.metaText}>{fmtDate(item.date)}</Text>
                <Text style={requestStyles.metaDot}>·</Text>
                <Text style={requestStyles.metaText}>{item.startTime} – {item.endTime}</Text>
                <Text style={requestStyles.metaDot}>·</Text>
                <Text style={requestStyles.metaTime}>{formatMinutes(worked)}</Text>
              </View>

              {item.travelMinutes > 0 ? (
                <View style={[styles.travelBadge, { alignSelf: "flex-start", marginTop: 6 }]}>
                  <Text style={styles.travelBadgeText}>
                    {formatMinutes(item.travelMinutes)} driving
                  </Text>
                </View>
              ) : null}

              <View style={requestStyles.reasonBox}>
                <Text style={requestStyles.reasonLabel}>Reason</Text>
                <Text style={requestStyles.reasonText}>{item.reason}</Text>
              </View>

              {item.notes ? (
                <Text style={requestStyles.notes} numberOfLines={2}>{item.notes}</Text>
              ) : null}

              <View style={requestStyles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    requestStyles.denyBtn,
                    pressed && { opacity: 0.8 },
                    isDenying && { opacity: 0.6 },
                  ]}
                  onPress={() => denyMutation.mutate(item.id)}
                  disabled={isDenying || isApproving}
                  testID={`deny-request-${item.id}`}
                >
                  {isDenying ? (
                    <ActivityIndicator color="#e53e3e" size="small" />
                  ) : (
                    <Text style={requestStyles.denyBtnText}>Deny</Text>
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    requestStyles.approveBtn,
                    pressed && { opacity: 0.8 },
                    isApproving && { opacity: 0.6 },
                  ]}
                  onPress={() => approveMutation.mutate(item.id)}
                  disabled={isApproving || isDenying}
                  testID={`approve-request-${item.id}`}
                >
                  {isApproving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={requestStyles.approveBtnText}>Approve</Text>
                  )}
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    );
  };

  const renderMyHoursView = () => {
    if (summaryLoading) {
      return (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2c7a7b" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={summaryRefetching || myRequestsRefetching}
            onRefresh={() => {
              refetchSummary();
              if (!isManager) refetchMyRequests();
            }}
            tintColor="#2c7a7b"
          />
        }
        ListHeaderComponent={
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
        }
        ListEmptyComponent={
          entries.length === 0 ? (
            <View style={styles.emptyState} testID="empty-state">
              <Text style={styles.emptyIcon}>⏱</Text>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptyText}>
                {isManager
                  ? "Tap the + button to log your first shift."
                  : "Submit a missed hours request if your hours are missing."}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const worked = computeWorkedMinutes(item.startTime, item.endTime);
          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                { opacity: pressed && isManager ? 0.85 : 1 },
              ]}
              onPress={() => isManager ? openEdit(item) : undefined}
              testID={`entry-item-${item.id}`}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardFacility}>{item.facilityName}</Text>
                <Text style={styles.cardWorked}>{formatMinutes(worked)}</Text>
              </View>
              <Text style={styles.cardDate}>{fmtDate(item.date)}</Text>
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
        ListFooterComponent={
          !isManager ? (
            <View style={{ paddingBottom: 24 }}>
              {/* Request Missed Hours button */}
              <Pressable
                style={({ pressed }) => [
                  requestStyles.requestBanner,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => {
                  setRequestForm({ ...EMPTY_REQUEST_FORM, date: getTodayString() });
                  setRequestVisible(true);
                }}
                testID="request-missed-hours-button"
              >
                <View style={requestStyles.requestBannerLeft}>
                  <Text style={requestStyles.requestBannerIcon}>📝</Text>
                  <View>
                    <Text style={requestStyles.requestBannerTitle}>Request Missed Hours</Text>
                    <Text style={requestStyles.requestBannerSub}>Hours missing? Submit a request for review</Text>
                  </View>
                </View>
                <Text style={requestStyles.requestBannerArrow}>→</Text>
              </Pressable>

              {/* My Requests section */}
              <Text style={requestStyles.sectionTitle}>My Requests</Text>

              {myRequestsLoading ? (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                  <ActivityIndicator color="#2c7a7b" />
                </View>
              ) : myRequestsList.length === 0 ? (
                <View style={requestStyles.emptyRequests}>
                  <Text style={requestStyles.emptyRequestsText}>No requests submitted yet.</Text>
                </View>
              ) : (
                myRequestsList.map((req) => {
                  const worked = computeWorkedMinutes(req.startTime, req.endTime);
                  const badgeStyle =
                    req.status === "approved"
                      ? requestStyles.badgeApproved
                      : req.status === "denied"
                      ? requestStyles.badgeDenied
                      : requestStyles.badgePending;
                  const badgeTextStyle =
                    req.status === "approved"
                      ? requestStyles.badgeTextApproved
                      : req.status === "denied"
                      ? requestStyles.badgeTextDenied
                      : requestStyles.badgeTextPending;
                  const badgeLabel =
                    req.status === "approved"
                      ? "Approved"
                      : req.status === "denied"
                      ? "Denied"
                      : "Pending";
                  return (
                    <View key={req.id} style={requestStyles.myRequestCard} testID={`my-request-${req.id}`}>
                      <View style={requestStyles.cardHeader}>
                        <Text style={requestStyles.facility}>{req.facilityName}</Text>
                        <View style={[requestStyles.badge, badgeStyle]}>
                          <Text style={[requestStyles.badgeText, badgeTextStyle]}>{badgeLabel}</Text>
                        </View>
                      </View>
                      <View style={requestStyles.metaRow}>
                        <Text style={requestStyles.metaText}>{fmtDate(req.date)}</Text>
                        <Text style={requestStyles.metaDot}>·</Text>
                        <Text style={requestStyles.metaText}>{req.startTime} – {req.endTime}</Text>
                        <Text style={requestStyles.metaDot}>·</Text>
                        <Text style={requestStyles.metaTime}>{formatMinutes(worked)}</Text>
                      </View>
                      {req.travelMinutes > 0 ? (
                        <View style={[styles.travelBadge, { alignSelf: "flex-start", marginTop: 4 }]}>
                          <Text style={styles.travelBadgeText}>{formatMinutes(req.travelMinutes)} driving</Text>
                        </View>
                      ) : null}
                      <Text style={requestStyles.reasonText} numberOfLines={2}>{req.reason}</Text>
                    </View>
                  );
                })
              )}
            </View>
          ) : null
        }
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

      {/* View toggle (manager only) */}
      {isManager ? (
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
          <Pressable
            style={[styles.viewToggleBtn, view === "pending-requests" && styles.viewToggleBtnActive]}
            onPress={() => setView("pending-requests")}
            testID="view-toggle-pending-requests"
          >
            <Text
              style={[styles.viewToggleText, view === "pending-requests" && styles.viewToggleTextActive]}
            >
              {pendingCount > 0 ? `Pending (${pendingCount})` : "Pending"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Content */}
      {isManager && view === "staff"
        ? renderStaffView()
        : isManager && view === "pending-requests"
        ? renderPendingRequestsView()
        : renderMyHoursView()}

      {/* Floating add button — manager only, in "mine" view */}
      {isManager && view === "mine" ? (
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

      {/* Add Modal (manager only) */}
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
              <View style={{ marginBottom: 14 }}>
                <DatePickerInput
                  value={form.date}
                  onChange={(v) => setForm((f) => ({ ...f, date: v }))}
                  format="YYYY-MM-DD"
                  testID="date-input"
                />
              </View>

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

      {/* Edit Modal (manager only) */}
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
              <View style={{ marginBottom: 14 }}>
                <DatePickerInput
                  value={editForm.date}
                  onChange={(v) => setEditForm((f) => ({ ...f, date: v }))}
                  format="YYYY-MM-DD"
                  testID="edit-date-input"
                />
              </View>

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

      {/* Request Missed Hours Modal (technician only) */}
      <Modal
        visible={requestVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRequestVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalWrapper}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setRequestVisible(false)} />
          <View style={styles.modalCard} testID="request-modal">
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Request Missed Hours</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Facility Name</Text>
              <TextInput
                style={styles.input}
                value={requestForm.facilityName}
                onChangeText={(v) => setRequestForm((f) => ({ ...f, facilityName: v }))}
                placeholder="e.g. St. Mary's Hospital"
                placeholderTextColor="#a0aec0"
                testID="req-facility-name-input"
              />

              <Text style={styles.inputLabel}>Date</Text>
              <View style={{ marginBottom: 14 }}>
                <DatePickerInput
                  value={requestForm.date}
                  onChange={(v) => setRequestForm((f) => ({ ...f, date: v }))}
                  format="YYYY-MM-DD"
                  testID="req-date-input"
                />
              </View>

              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>Start Time</Text>
                  <TextInput
                    style={styles.input}
                    value={requestForm.startTime}
                    onChangeText={(v) => setRequestForm((f) => ({ ...f, startTime: v }))}
                    placeholder="08:00"
                    placeholderTextColor="#a0aec0"
                    testID="req-start-time-input"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.inputLabel}>End Time</Text>
                  <TextInput
                    style={styles.input}
                    value={requestForm.endTime}
                    onChangeText={(v) => setRequestForm((f) => ({ ...f, endTime: v }))}
                    placeholder="16:00"
                    placeholderTextColor="#a0aec0"
                    testID="req-end-time-input"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Driving Time (minutes)</Text>
              <TextInput
                style={styles.input}
                value={requestForm.travelMinutes}
                onChangeText={(v) => setRequestForm((f) => ({ ...f, travelMinutes: v }))}
                placeholder="0"
                placeholderTextColor="#a0aec0"
                keyboardType="numeric"
                testID="req-travel-minutes-input"
              />

              <Text style={styles.inputLabel}>Reason (required)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={requestForm.reason}
                onChangeText={(v) => setRequestForm((f) => ({ ...f, reason: v }))}
                placeholder="Why are these hours missing?"
                placeholderTextColor="#a0aec0"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                testID="req-reason-input"
              />

              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={requestForm.notes}
                onChangeText={(v) => setRequestForm((f) => ({ ...f, notes: v }))}
                placeholder="Any additional details..."
                placeholderTextColor="#a0aec0"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                testID="req-notes-input"
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setRequestVisible(false)}
                  testID="cancel-request-button"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveBtn, !isRequestValid && styles.saveBtnDisabled]}
                  onPress={handleSubmitRequest}
                  disabled={submitRequestMutation.isPending || !isRequestValid}
                  testID="submit-request-button"
                >
                  {submitRequestMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Submit</Text>
                  )}
                </Pressable>
              </View>
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
  viewToggleText: { fontSize: 13, fontWeight: "600", color: "#a0aec0" },
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

const requestStyles = StyleSheet.create({
  // Technician banner to trigger request
  requestBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fefce8",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  requestBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  requestBannerIcon: { fontSize: 22 },
  requestBannerTitle: { fontSize: 14, fontWeight: "700", color: "#92400e" },
  requestBannerSub: { fontSize: 12, color: "#78350f", marginTop: 1 },
  requestBannerArrow: { fontSize: 16, color: "#92400e", fontWeight: "700" },

  // Section title
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a365d",
    marginBottom: 12,
  },

  // Request cards (both manager pending view and technician "my requests")
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
  myRequestCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  techName: { fontSize: 15, fontWeight: "700", color: "#1a365d" },
  facility: { fontSize: 14, fontWeight: "600", color: "#2d3748", flex: 1, marginRight: 8 },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
    marginBottom: 6,
  },
  metaText: { fontSize: 13, color: "#718096" },
  metaDot: { fontSize: 13, color: "#cbd5e0" },
  metaTime: { fontSize: 13, fontWeight: "700", color: "#2c7a7b" },

  reasonBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a0aec0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  reasonText: { fontSize: 13, color: "#4a5568", lineHeight: 19 },

  notes: { fontSize: 12, color: "#718096", fontStyle: "italic", marginTop: 4 },

  // Status badges (pill-shaped)
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  badgePending: { backgroundColor: "#fef3c7" },
  badgeTextPending: { color: "#92400e" },
  badgeApproved: { backgroundColor: "#d1fae5" },
  badgeTextApproved: { color: "#065f46" },
  badgeDenied: { backgroundColor: "#fee2e2" },
  badgeTextDenied: { color: "#991b1b" },

  // Action buttons on manager pending cards
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  denyBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#fed7d7",
  },
  denyBtnText: { fontSize: 14, fontWeight: "700", color: "#e53e3e" },
  approveBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#2c7a7b",
  },
  approveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  emptyRequests: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyRequestsText: { fontSize: 14, color: "#a0aec0" },
});
