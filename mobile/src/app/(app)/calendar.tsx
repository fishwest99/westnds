import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/api";

// ─── Google Calendar iCal ─────────────────────────────────────────────────────

const ICAL_URL = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_ICAL_URL ?? "";

type GCalEvent = {
  uid: string;
  title: string;
  date: string;       // YYYY-MM-DD (start date)
  endDate: string;    // YYYY-MM-DD
  startTime: string;  // HH:MM or "" if all-day
  endTime: string;    // HH:MM or ""
  location: string;
  description: string;
  allDay: boolean;
};

function unfoldIcal(raw: string): string {
  // Normalize CRLF/CR to LF so single-line regexes work, then unfold continuation lines.
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "");
}

function parseIcalDate(val: string): { date: string; time: string; allDay: boolean } {
  if (/^\d{8}$/.test(val)) {
    const d = val;
    return {
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      time: "",
      allDay: true,
    };
  }
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (m) {
    return {
      date: `${m[1]}-${m[2]}-${m[3]}`,
      time: `${m[4]}:${m[5]}`,
      allDay: false,
    };
  }
  return { date: "", time: "", allDay: true };
}

function parseIcalEvents(raw: string): GCalEvent[] {
  const text = unfoldIcal(raw);
  const events: GCalEvent[] = [];
  const blocks = text.split("BEGIN:VEVENT");
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const get = (key: string): string => {
      const re = new RegExp(`(?:^|\\n)${key}(?:;[^:]*)?:(.+?)(?:\\n|$)`, "i");
      const m = block.match(re);
      return m ? m[1].replace(/\\n/g, "\n").replace(/\\,/g, ",").trim() : "";
    };
    const dtStartRaw = get("DTSTART");
    const dtEndRaw = get("DTEND");
    if (!dtStartRaw) continue;
    const start = parseIcalDate(dtStartRaw);
    const end = dtEndRaw ? parseIcalDate(dtEndRaw) : start;
    let endDate = end.date;
    if (start.allDay && endDate && endDate !== start.date) {
      const ed = new Date(endDate + "T00:00:00");
      ed.setDate(ed.getDate() - 1);
      endDate = ed.toISOString().split("T")[0];
    }
    events.push({
      uid: get("UID"),
      title: get("SUMMARY") || "(No title)",
      date: start.date,
      endDate: endDate || start.date,
      startTime: start.time,
      endTime: end.time,
      location: get("LOCATION"),
      description: get("DESCRIPTION"),
      allDay: start.allDay,
    });
  }
  return events;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarEvent = {
  id: string;
  userId: string;
  createdByName: string;
  title: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:MM or ""
  endTime: string;     // HH:MM or ""
  location: string;
  description: string;
  createdAt: string;
};

type UserProfile = { isManager: boolean };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDaysInMonth = (year: number, month: number): (number | null)[] => {
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
};

const toDateStr = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const formatTime = (t: string): string | null => {
  if (!t) return null;
  const parts = t.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fmtDate = (d: string) => {
  if (!d) return d;
  if (d.includes('/')) return d;
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  // Add event form state
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDate, setFormDate] = useState<string>("");
  const [formStartTime, setFormStartTime] = useState<string>("");
  const [formEndTime, setFormEndTime] = useState<string>("");
  const [formLocation, setFormLocation] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => api.get<UserProfile>("/api/time-off/my-profile"),
  });
  const isManager = profile?.isManager ?? false;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["calendar-events", year, month],
    queryFn: () =>
      api.get<CalendarEvent[]>(
        `/api/calendar-events?month=${year}-${String(month).padStart(2, "0")}`
      ),
  });

  const events: CalendarEvent[] = data ?? [];

  // ── Google Calendar query ──────────────────────────────────────────────────

  const {
    data: gCalEvents = [],
    isLoading: gCalLoading,
    error: gCalError,
    refetch: refetchGCal,
  } = useQuery({
    queryKey: ["gcal-events"],
    queryFn: async (): Promise<GCalEvent[]> => {
      console.log("[gcal] ICAL_URL =", ICAL_URL || "(empty)");
      if (!ICAL_URL) throw new Error("EXPO_PUBLIC_GOOGLE_CALENDAR_ICAL_URL not set");

      const fetchCandidates: string[] = [];
      if (Platform.OS !== "web") {
        fetchCandidates.push(ICAL_URL);
      }
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (backendUrl) {
        fetchCandidates.push(
          `${backendUrl}/api/google-calendar/ical?url=${encodeURIComponent(ICAL_URL)}`
        );
      }
      fetchCandidates.push(
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(ICAL_URL)}`
      );

      const attempts: string[] = [];
      for (const url of fetchCandidates) {
        try {
          console.log("[gcal] fetching:", url);
          const res = await fetch(url);
          if (!res.ok) {
            attempts.push(`${url} → HTTP ${res.status}`);
            console.log("[gcal] HTTP", res.status, "for", url);
            continue;
          }
          const text = await res.text();
          if (!text.includes("BEGIN:VCALENDAR")) {
            attempts.push(`${url} → not iCal (${text.length} bytes)`);
            console.log("[gcal] not iCal body for", url);
            continue;
          }
          const parsed = parseIcalEvents(text);
          console.log("[gcal] parsed", parsed.length, "events from", url);
          return parsed;
        } catch (e) {
          attempts.push(`${url} → ${(e as Error).message}`);
          console.log("[gcal] fetch error for", url, e);
          continue;
        }
      }
      throw new Error("All fetch attempts failed:\n" + attempts.join("\n"));
    },
    enabled: !!ICAL_URL,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  // Filter GCal events to current month
  const gCalMonthEvents = useMemo(() => {
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    return gCalEvents.filter((ev) => ev.date.startsWith(monthStr));
  }, [gCalEvents, year, month]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      location: string;
      description: string;
    }) => api.post<CalendarEvent>("/api/calendar-events", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/calendar-events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openModal = () => {
    setFormTitle("");
    setFormDate(selectedDate ?? todayStr);
    setFormStartTime("");
    setFormEndTime("");
    setFormLocation("");
    setFormDescription("");
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const handleSave = () => {
    if (!formTitle.trim() || !formDate.trim()) return;
    createMutation.mutate({
      title: formTitle.trim(),
      date: formDate.trim(),
      startTime: formStartTime.trim(),
      endTime: formEndTime.trim(),
      location: formLocation.trim(),
      description: formDescription.trim(),
    });
  };

  // ── Month navigation ───────────────────────────────────────────────────────

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // ── Calendar grid ──────────────────────────────────────────────────────────

  const cells = useMemo(() => getDaysInMonth(year, month), [year, month]);

  // Map date string -> events for quick lookup
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  // Map date string -> GCal events for quick lookup
  const gCalByDate = useMemo(() => {
    const map: Record<string, GCalEvent[]> = {};
    for (const ev of gCalMonthEvents) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [gCalMonthEvents]);

  // ── Events list ────────────────────────────────────────────────────────────

  const displayedEvents = useMemo(() => {
    if (selectedDate) {
      return (eventsByDate[selectedDate] ?? []).slice().sort((a, b) => {
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        return 0;
      });
    }
    // Upcoming events from today onward
    return events
      .filter((ev) => ev.date >= todayStr)
      .slice()
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        return 0;
      });
  }, [selectedDate, eventsByDate, events, todayStr]);

  // GCal events for the selected day
  const displayedGCalEvents = useMemo(() => {
    if (selectedDate) {
      return (gCalByDate[selectedDate] ?? []).slice().sort((a, b) => {
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        return 0;
      });
    }
    return [];
  }, [selectedDate, gCalByDate]);

  // Upcoming GCal events merged into main upcoming list (no day selected)
  const upcomingGCalEvents = useMemo(() => {
    if (selectedDate) return [];
    return gCalEvents
      .filter((ev) => ev.date >= todayStr)
      .slice()
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        return 0;
      });
  }, [selectedDate, gCalEvents, todayStr]);

  const sectionTitle = selectedDate
    ? (() => {
        const [y, mo, d] = selectedDate.split("-").map(Number);
        return `${MONTH_NAMES[mo - 1]} ${d}, ${y}`;
      })()
    : "Upcoming Events";

  const canSave = formTitle.trim().length > 0 && formDate.trim().length > 0;

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderGCalCard = (ev: GCalEvent, showGBadge: boolean) => {
    const startFmt = formatTime(ev.startTime);
    const endFmt = formatTime(ev.endTime);
    let timeLabel: string | null = null;
    if (startFmt && endFmt) {
      timeLabel = `${startFmt} – ${endFmt}`;
    } else if (startFmt) {
      timeLabel = startFmt;
    }

    return (
      <View key={ev.uid} style={styles.gcalCard} testID={`gcal-event-card-${ev.uid}`}>
        <View style={styles.gcalCardTop}>
          <Text style={styles.gcalTitle}>{ev.title}</Text>
          {showGBadge ? (
            <View style={styles.gBadge}>
              <Text style={styles.gBadgeText}>G</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.gcalTime}>{timeLabel ?? "All day"}</Text>
        {ev.location ? (
          <Text style={styles.gcalLocation}>📍 {ev.location}</Text>
        ) : null}
        {ev.description ? (
          <Text style={styles.gcalDesc} numberOfLines={2}>{ev.description}</Text>
        ) : null}
        <View style={styles.gcalFooter}>
          {!selectedDate ? (
            <Text style={styles.gcalTime}>{fmtDate(ev.date)}</Text>
          ) : (
            <View />
          )}
          <Text style={styles.gcalBadge}>via Google Calendar</Text>
        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="calendar-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Calendar</Text>
        <Pressable onPress={openModal} style={styles.addBtn} testID="add-event-button">
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6b46c1" />
        }
        testID="calendar-scroll"
      >
        {/* Google Calendar diagnostics (always visible) */}
        <View style={styles.gcalDiag} testID="gcal-diagnostics">
          <Text style={styles.gcalDiagTitle}>Google Calendar Status</Text>
          {!ICAL_URL ? (
            <Text style={styles.gcalDiagError}>
              EXPO_PUBLIC_GOOGLE_CALENDAR_ICAL_URL is not set
            </Text>
          ) : gCalLoading ? (
            <Text style={styles.gcalDiagInfo}>Loading…</Text>
          ) : gCalError ? (
            <>
              <Text style={styles.gcalDiagError}>
                Fetch failed: {(gCalError as Error).message}
              </Text>
              <Pressable
                onPress={() => refetchGCal()}
                style={styles.gcalDiagBtn}
                testID="gcal-retry"
              >
                <Text style={styles.gcalDiagBtnText}>Retry</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.gcalDiagInfo}>
              {gCalEvents.length} total events fetched · {upcomingGCalEvents.length} upcoming
            </Text>
          )}
          <Text style={styles.gcalDiagUrl} numberOfLines={2}>
            URL: {ICAL_URL || "(none)"}
          </Text>
        </View>

        {/* Month Navigator */}
        <View style={styles.monthNav}>
          <Pressable onPress={prevMonth} style={styles.navBtn} testID="prev-month-button">
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel} testID="month-label">
            {MONTH_NAMES[month - 1]} {year}
          </Text>
          <Pressable onPress={nextMonth} style={styles.navBtn} testID="next-month-button">
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>

        {/* Calendar Grid */}
        <View style={styles.gridContainer}>
          {/* Day-of-week headers */}
          <View style={styles.dayHeaderRow}>
            {DAY_LABELS.map((label) => (
              <View key={label} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Day cells */}
          {isLoading ? (
            <View style={styles.gridLoading} testID="grid-loading">
              <ActivityIndicator color="#6b46c1" />
            </View>
          ) : (
            <View style={styles.daysGrid}>
              {cells.map((day, idx) => {
                if (day === null) {
                  return <View key={`empty-${idx}`} style={styles.dayCell} />;
                }
                const dateStr = toDateStr(year, month, day);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const dayEvents = eventsByDate[dateStr] ?? [];
                const dayGCalEvents = gCalByDate[dateStr] ?? [];

                // Build dots: purple for in-app (up to 1), green for gcal (up to 1), max 2 total
                const purpleDots = Math.min(dayEvents.length, 1);
                const greenDots = Math.min(dayGCalEvents.length, 2 - purpleDots);

                return (
                  <Pressable
                    key={dateStr}
                    style={styles.dayCell}
                    onPress={() =>
                      setSelectedDate((prev) => (prev === dateStr ? null : dateStr))
                    }
                    testID={`day-cell-${dateStr}`}
                  >
                    <View
                      style={[
                        styles.dayNumber,
                        isSelected && styles.dayNumberSelected,
                        isToday && !isSelected && styles.dayNumberToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isToday && !isSelected && styles.dayTextToday,
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                    <View style={styles.dotsRow}>
                      {Array.from({ length: purpleDots }).map((_, di) => (
                        <View key={`p-${di}`} style={styles.dot} />
                      ))}
                      {Array.from({ length: greenDots }).map((_, di) => (
                        <View key={`g-${di}`} style={styles.gcalDot} />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Events Section */}
        <View style={styles.eventsSection}>
          <Text style={styles.eventsSectionTitle} testID="events-section-title">
            {sectionTitle}
          </Text>

          {/* In-app events */}
          {displayedEvents.length === 0 && (!selectedDate || displayedGCalEvents.length === 0) ? (
            <View style={styles.emptyState} testID="empty-events">
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>
                {selectedDate ? "No events on this day" : "No upcoming events"}
              </Text>
            </View>
          ) : (
            displayedEvents.map((ev) => {
              const startFmt = formatTime(ev.startTime);
              const endFmt = formatTime(ev.endTime);
              let timeLabel: string | null = null;
              if (startFmt && endFmt) {
                timeLabel = `${startFmt} – ${endFmt}`;
              } else if (startFmt) {
                timeLabel = startFmt;
              }

              return (
                <View key={ev.id} style={styles.eventCard} testID={`event-card-${ev.id}`}>
                  <View style={styles.eventCardTop}>
                    <Text style={styles.eventTitle}>{ev.title}</Text>
                    {isManager ? (
                      <Pressable
                        onPress={() => deleteMutation.mutate(ev.id)}
                        style={styles.deleteBtn}
                        testID={`delete-event-${ev.id}`}
                        disabled={deleteMutation.isPending}
                      >
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <Text style={styles.eventTime}>
                    {timeLabel ?? "All day"}
                  </Text>

                  {ev.location ? (
                    <Text style={styles.eventLocation}>📍 {ev.location}</Text>
                  ) : null}

                  {ev.description ? (
                    <Text style={styles.eventDescription}>{ev.description}</Text>
                  ) : null}

                  {!selectedDate ? (
                    <Text style={styles.eventDateLabel}>{fmtDate(ev.date)}</Text>
                  ) : null}

                  <Text style={styles.eventAddedBy}>Added by {ev.createdByName}</Text>
                </View>
              );
            })
          )}

          {/* Upcoming: merge GCal events (no day selected) */}
          {!selectedDate && ICAL_URL && upcomingGCalEvents.length > 0 ? (
            upcomingGCalEvents.map((ev) => renderGCalCard(ev, true))
          ) : null}

          {/* Selected day: Google Calendar sub-section */}
          {selectedDate && ICAL_URL && displayedGCalEvents.length > 0 ? (
            <View testID="gcal-section">
              <Text style={styles.gcalSectionLabel}>Google Calendar</Text>
              {displayedGCalEvents.map((ev) => renderGCalCard(ev, false))}
            </View>
          ) : null}

          {/* Bottom padding */}
          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {/* Add Event Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
        testID="add-event-modal"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Event</Text>

            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="Event title"
              placeholderTextColor="#a0aec0"
              testID="form-title-input"
            />

            <Text style={styles.inputLabel}>Date *</Text>
            <TextInput
              style={styles.input}
              value={formDate}
              onChangeText={setFormDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#a0aec0"
              testID="form-date-input"
            />

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.inputLabel}>Start Time</Text>
                <TextInput
                  style={styles.input}
                  value={formStartTime}
                  onChangeText={setFormStartTime}
                  placeholder="09:00"
                  placeholderTextColor="#a0aec0"
                  testID="form-start-time-input"
                />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.inputLabel}>End Time</Text>
                <TextInput
                  style={styles.input}
                  value={formEndTime}
                  onChangeText={setFormEndTime}
                  placeholder="17:00"
                  placeholderTextColor="#a0aec0"
                  testID="form-end-time-input"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Location</Text>
            <TextInput
              style={styles.input}
              value={formLocation}
              onChangeText={setFormLocation}
              placeholder="Optional"
              placeholderTextColor="#a0aec0"
              testID="form-location-input"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder="Optional details"
              placeholderTextColor="#a0aec0"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              testID="form-description-input"
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={closeModal}
                testID="cancel-button"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!canSave || createMutation.isPending}
                testID="save-event-button"
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
  backBtn: { paddingRight: 12, minWidth: 60 },
  backText: { color: "#90cdf4", fontSize: 15, fontWeight: "600" },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  addBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 60,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Scroll
  scrollArea: { flex: 1 },

  // Month Navigator
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  navBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
  },
  navArrow: { fontSize: 28, color: "#6b46c1", fontWeight: "300", lineHeight: 32 },
  monthLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a365d",
    textAlign: "center",
  },

  // Grid
  gridContainer: {
    backgroundColor: "#fff",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dayHeaderRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: "center",
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a0aec0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  gridLoading: {
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 4,
  },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 0.85,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  dayNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  dayNumberToday: {
    backgroundColor: "#6b46c1",
  },
  dayNumberSelected: {
    backgroundColor: "#1a365d",
  },
  dayText: {
    fontSize: 14,
    color: "#2d3748",
    fontWeight: "500",
  },
  dayTextToday: {
    color: "#fff",
    fontWeight: "700",
  },
  dayTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 2,
    height: 6,
    alignItems: "center",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#6b46c1",
  },

  // Events Section
  eventsSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  eventsSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a365d",
    marginBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#a0aec0", fontWeight: "500" },

  // Event Card
  eventCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  eventCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a365d",
    flex: 1,
    marginRight: 8,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtnText: { fontSize: 13, color: "#e53e3e", fontWeight: "700" },
  eventTime: {
    fontSize: 13,
    color: "#6b46c1",
    fontWeight: "600",
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 13,
    color: "#4a5568",
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 12,
    color: "#718096",
    lineHeight: 18,
    marginBottom: 4,
  },
  eventDateLabel: {
    fontSize: 12,
    color: "#a0aec0",
    marginBottom: 2,
  },
  eventAddedBy: {
    fontSize: 11,
    color: "#cbd5e0",
    marginTop: 4,
  },

  // Google Calendar Cards
  gcalCard: {
    backgroundColor: "#f0fff4",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#38a169",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  gcalCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  gcalTitle: { fontSize: 15, fontWeight: "700", color: "#1a365d", flex: 1, marginRight: 8 },
  gcalTime: { fontSize: 13, color: "#4a5568" },
  gcalLocation: { fontSize: 13, color: "#4a5568", marginTop: 2 },
  gcalDesc: { fontSize: 12, color: "#718096", marginTop: 4 },
  gcalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  gcalBadge: { fontSize: 11, color: "#718096", fontStyle: "italic" },
  gcalSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#276749",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  gcalDiag: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  gcalDiagTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  gcalDiagInfo: {
    fontSize: 13,
    color: "#166534",
  },
  gcalDiagError: {
    fontSize: 13,
    color: "#991b1b",
  },
  gcalDiagBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#16a34a",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  gcalDiagBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  gcalDiagUrl: {
    marginTop: 6,
    fontSize: 10,
    color: "#4b5563",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  gcalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#38a169",
  },
  gBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#38a169",
    justifyContent: "center",
    alignItems: "center",
  },
  gBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },

  // Modal
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
    maxHeight: "92%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1a365d",
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
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
  textArea: { minHeight: 72, textAlignVertical: "top" },
  timeRow: { flexDirection: "row", gap: 12 },
  timeField: { flex: 1 },
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
    backgroundColor: "#6b46c1",
  },
  saveBtnDisabled: { backgroundColor: "#c4b5fd" },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
