import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CalendarScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="calendar-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>📅</Text>
        </View>
        <Text style={styles.title}>Google Calendar</Text>
        <Text style={styles.subtitle}>Integration Coming Soon</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            The calendar feature will sync with Google Calendar to show upcoming
            procedures, case schedules, and team availability.
          </Text>
          <View style={styles.divider} />
          <Text style={styles.contactLabel}>To enable this feature:</Text>
          <Text style={styles.contactText}>Contact your West NDx administrator to set up Google Calendar integration for your account.</Text>
        </View>
      </View>
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

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#e9d8fd",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  icon: { fontSize: 40 },
  title: { fontSize: 24, fontWeight: "800", color: "#1a365d", textAlign: "center" },
  subtitle: { fontSize: 16, color: "#718096", marginTop: 6, marginBottom: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardText: { fontSize: 14, color: "#4a5568", lineHeight: 22, textAlign: "center" },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 16 },
  contactLabel: { fontSize: 13, fontWeight: "700", color: "#1a365d", marginBottom: 6 },
  contactText: { fontSize: 13, color: "#4a5568", lineHeight: 20 },
});
