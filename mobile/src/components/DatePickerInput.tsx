import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
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

function getTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

// Convert from display format to YYYY-MM-DD for the Calendar
function toISO(value: string, format: "MM/DD/YYYY" | "YYYY-MM-DD"): string {
  if (!value) return "";
  if (format === "YYYY-MM-DD") return value;
  // MM/DD/YYYY -> YYYY-MM-DD
  const parts = value.split("/");
  if (parts.length !== 3) return "";
  const [mm, dd, yyyy] = parts;
  if (!mm || !dd || !yyyy || yyyy.length !== 4) return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// Convert from YYYY-MM-DD to display format
function fromISO(iso: string, format: "MM/DD/YYYY" | "YYYY-MM-DD"): string {
  if (!iso) return "";
  if (format === "YYYY-MM-DD") return iso;
  // YYYY-MM-DD -> MM/DD/YYYY
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
  const [modalVisible, setModalVisible] = useState(false);
  const today = getTodayISO();
  const resolvedMaxDate = maxDate ?? today;

  // The ISO date currently selected (for the calendar)
  const selectedISO = toISO(value, format);

  const markedDates = selectedISO
    ? { [selectedISO]: { selected: true, selectedColor: "#2c7a7b" } }
    : {};

  const handleDayPress = (day: { dateString: string }) => {
    const displayValue = fromISO(day.dateString, format);
    setModalVisible(false);
    onChange(displayValue);
  };

  const displayText = value || null;

  return (
    <View testID={testID}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={styles.inputBox}
        onPress={() => setModalVisible(true)}
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
            <Calendar
              onDayPress={handleDayPress}
              markedDates={markedDates}
              minDate={minDate}
              maxDate={resolvedMaxDate}
              current={selectedISO || today}
              theme={{
                todayTextColor: "#2c7a7b",
                arrowColor: "#2c7a7b",
                selectedDayBackgroundColor: "#2c7a7b",
                selectedDayTextColor: "#fff",
                dotColor: "#2c7a7b",
                textDayFontSize: 15,
                textMonthFontSize: 15,
                textDayHeaderFontSize: 13,
              }}
            />
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
    fontSize: 15,
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
    paddingVertical: 16,
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
});
