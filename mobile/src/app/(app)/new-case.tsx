import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api/api";

export default function NewCaseScreen() {
  const router = useRouter();
  const [patientName, setPatientName] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}/${d.getFullYear()}`;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!patientName.trim()) { setError("Patient name is required."); return; }
    setError("");
    setLoading(true);
    try {
      const result = await api.post<{ id: string }>("/api/cases", { patientName: patientName.trim(), date });
      if (!result?.id) { setError("Failed to create case. Please try again."); return; }
      router.replace(`/case/${result.id}` as never);
    } catch {
      setError("Failed to create case. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="new-case-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
              <Text style={styles.backText}>← Home</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Start New Case</Text>
            <Text style={styles.headerSub}>Enter patient information to begin</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Patient Information</Text>

            <Text style={styles.label}>Patient Name *</Text>
            <TextInput
              style={styles.input}
              value={patientName}
              onChangeText={setPatientName}
              placeholder="Full patient name"
              autoFocus
              returnKeyType="next"
              testID="patient-name-input"
            />

            <Text style={styles.label}>Date of Service</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="MM/DD/YYYY"
              keyboardType="numbers-and-punctuation"
              testID="date-input"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
              onPress={handleCreate}
              disabled={loading}
              testID="create-case-button"
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.createBtnText}>Create Patient Case →</Text>}
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a365d" },
  scroll: { flexGrow: 1 },
  header: {
    backgroundColor: "#1a365d",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 24,
  },
  backBtn: { marginBottom: 16 },
  backText: { color: "#90cdf4", fontSize: 14, fontWeight: "600" },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  headerSub: { fontSize: 14, color: "#bee3f8", marginTop: 6 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1a365d", marginBottom: 20 },
  label: { fontSize: 12, fontWeight: "600", color: "#4a5568", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 10, padding: 14,
    fontSize: 16, backgroundColor: "#f8fafc", color: "#1a202c", marginBottom: 16,
  },
  error: { color: "#e53e3e", fontSize: 13, marginBottom: 12 },
  createBtn: {
    backgroundColor: "#1a365d", borderRadius: 12, padding: 18,
    alignItems: "center", marginTop: 8,
  },
  createBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
