import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Calendar } from "react-native-calendars";

interface DatePickerInputProps {
  value: string;
  onChange: (date: string) => void;
  format?: "MM/DD/YYYY" | "YYYY-MM-DD";
  placeholder?: string;
  testID?: string;
  label?: string;
  minDate?: string;
  maxDate?: string;
}

type PickerMode = "calendar" | "year";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function toISO(value: string, format: "MM/DD/YYYY" | "YYYY-MM-DD"): string {
  if (!value) return "";
  if (format === "YYYY-MM-DD") return value;
  const parts = value.split("/");
  if (parts.length !== 3) return "";
  const [mm, dd, yyyy] = parts;
  if (!mm || !dd || !yyyy || yyyy.length !== 4) return "";
  return `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
}

function fromISO(iso: string, format: "MM/DD/YYYY" | "YYYY-MM-DD"): string {
  if (!iso) return "";
  if (format === "YYYY-MM-DD") return iso;
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const [yyyy, mm, dd] = parts;
  return `${mm}/${dd}/${yyyy}`;
}

export function DatePickerInput({
  value,
  onChange,
  format = "MM/DD/YYYY",
  placeholder = "Select date",
  testID,
  label,
  minDate = "1930-01-01",
  maxDate,
}: DatePickerInputProps) {
  const today = getTodayISO();
  const resolvedMaxDate = maxDate ?? today;
  const minYear = parseInt(minDate.slice(0, 4), 10);
  const maxYear = parseInt(resolvedMaxDate.slice(0, 4), 10);

  const [modalVisible, setModalVisible] = useState(false);
  const [mode, setMode] = useState<PickerMode>("calendar");
  const [calendarKey, setCalendarKey] = useState(0);

  const selectedISO = toISO(value, format);
  const selectedYear = selectedISO ? parseInt(selectedISO.slice(0, 4), 10) : new Date().getFullYear();

  const [displayedMonth, setDisplayedMonth] = useState<string>(() =>
    selectedISO ? selectedISO.slice(0, 7) + "-01" : today.slice(0, 7) + "-01"
  );

  const yearScrollRef = useRef<ScrollView>(null);

  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  // Scroll to the relevant year when year picker opens
  useEffect(() => {
    if (mode === "year") {
      const targetYear = selectedISO ? selectedYear : new Date().getFullYear();
      const idx = years.indexOf(targetYear);
      if (idx >= 0 && yearScrollRef.current) {
        // 4 cols, each row ~52px tall
        const row = Math.floor(idx / 4);
        const offset = Math.max(0, (row - 3) * 52);
        setTimeout(() => {
          yearScrollRef.current?.scrollTo({ y: offset, animated: false });
        }, 80);
      }
    }
  }, [mode]);

  const openModal = () => {
    setMode("calendar");
    const base = selectedISO || today;
    setDisplayedMonth(base.slice(0, 7) + "-01");
    setModalVisible(true);
  };

  const handleDayPress = (day: { dateString: string }) => {
    onChange(fromISO(day.dateString, format));
    setModalVisible(false);
  };

  const handleYearSelect = (year: number) => {
    const monthPart = displayedMonth.slice(5, 7);
    setDisplayedMonth(`${year}-${monthPart}-01`);
    setCalendarKey(k => k + 1);
    setMode("calendar");
  };

  const displayedYear = parseInt(displayedMonth.slice(0, 4), 10);
  const displayedMonthIdx = parseInt(displayedMonth.slice(5, 7), 10) - 1;

  const markedDates = selectedISO
    ? { [selectedISO]: { selected: true, selectedColor: "#2c7a7b" } }
    : {};

  const displayText = value || null;

  return (
    <View testID={testID}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={styles.inputBox}
        onPress={openModal}
        testID={testID ? `${testID}-trigger` : undefined}
      >
        <Text style={displayText ? styles.valueText : styles.placeholderText}>
          {displayText ?? placeholder}
        </Text>
        <Text style={styles.calendarIcon}>📅</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            {/* Modal header */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Select Date</Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                testID={testID ? `${testID}-close` : undefined}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {mode === "year" ? (
              /* ── Year picker ── */
              <View style={styles.yearPickerContainer}>
                <View style={styles.yearPickerHeader}>
                  <Text style={styles.yearPickerTitle}>Select Year</Text>
                  <Pressable onPress={() => setMode("calendar")} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Back</Text>
                  </Pressable>
                </View>
                <ScrollView
                  ref={yearScrollRef}
                  style={styles.yearScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.yearGrid}>
                    {years.map((year) => {
                      const isSelected = year === selectedYear && !!selectedISO;
                      const isCurrent = year === new Date().getFullYear();
                      return (
                        <Pressable
                          key={year}
                          style={[
                            styles.yearCell,
                            isSelected && styles.yearCellSelected,
                            !isSelected && isCurrent && styles.yearCellCurrent,
                          ]}
                          onPress={() => handleYearSelect(year)}
                          testID={`year-${year}`}
                        >
                          <Text
                            style={[
                              styles.yearCellText,
                              isSelected && styles.yearCellTextSelected,
                              !isSelected && isCurrent && styles.yearCellTextCurrent,
                            ]}
                          >
                            {year}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ) : (
              /* ── Calendar view ── */
              <View>
                {/* Tappable month/year strip */}
                <Pressable
                  style={styles.monthYearStrip}
                  onPress={() => setMode("year")}
                  testID="month-year-strip"
                >
                  <Text style={styles.monthYearText}>
                    {MONTH_NAMES[displayedMonthIdx]} {displayedYear}
                  </Text>
                  <View style={styles.changeYearBadge}>
                    <Text style={styles.changeYearText}>Change Year ▼</Text>
                  </View>
                </Pressable>

                <Calendar
                  key={calendarKey}
                  onDayPress={handleDayPress}
                  markedDates={markedDates}
                  minDate={minDate}
                  maxDate={resolvedMaxDate}
                  current={displayedMonth}
                  onMonthChange={(month: { year: number; month: number }) => {
                    setDisplayedMonth(
                      `${month.year}-${String(month.month).padStart(2, "0")}-01`
                    );
                  }}
                  hideExtraDays={false}
                  theme={{
                    todayTextColor: "#2c7a7b",
                    arrowColor: "#2c7a7b",
                    selectedDayBackgroundColor: "#2c7a7b",
                    selectedDayTextColor: "#fff",
                    textDayFontSize: 15,
                    textMonthFontSize: 1,   // hide built-in month text (we show our own above)
                    textMonthFontWeight: "400",
                    textDayHeaderFontSize: 13,
                    calendarBackground: "#fff",
                    monthTextColor: "transparent",
                  }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4a5568",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  inputBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 46,
  },
  valueText: {
    fontSize: 15,
    color: "#1a202c",
    flex: 1,
  },
  placeholderText: {
    fontSize: 15,
    color: "#a0aec0",
    flex: 1,
  },
  calendarIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a202c",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f4f8",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 14,
    color: "#4a5568",
    fontWeight: "600",
  },
  // Month/year strip (tappable, sits above calendar)
  monthYearStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f0faf9",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a202c",
  },
  changeYearBadge: {
    backgroundColor: "#2c7a7b",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  changeYearText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  // Year picker
  yearPickerContainer: {
    maxHeight: 340,
  },
  yearPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f0faf9",
  },
  yearPickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a202c",
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2c7a7b",
  },
  yearScroll: {
    maxHeight: 280,
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
  },
  yearCell: {
    width: "25%",
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
    marginVertical: 2,
  },
  yearCellSelected: {
    backgroundColor: "#2c7a7b",
  },
  yearCellCurrent: {
    backgroundColor: "#e6f4f4",
  },
  yearCellText: {
    fontSize: 15,
    color: "#2d3748",
    fontWeight: "400",
  },
  yearCellTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  yearCellTextCurrent: {
    color: "#2c7a7b",
    fontWeight: "600",
  },
});
