import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const FORM_OPTIONS = [
  {
    id: "consent-form",
    label: "Consent Form",
    icon: "📋",
    description: "Informed consent, assignment of benefits & financial responsibility",
    accent: "#2b6cb0",
    bg: "#ebf4ff",
    href: "/consent-form/new" as const,
  },
  {
    id: "billing-sheet",
    label: "Billing Sheet",
    icon: "🧾",
    description: "West Neurodiagnostic Services billing & CPT codes",
    accent: "#276749",
    bg: "#e6ffef",
    href: "/billing-form/new" as const,
  },
] as const;

export default function NewCaseScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a365d" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="new-case-screen"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            testID="back-button"
          >
            <Text style={styles.backText}>← Home</Text>
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Start New Case</Text>
            <Text style={styles.headerSub}>Choose the form to begin</Text>
          </View>
        </View>

        {/* Form Cards */}
        <View style={styles.cardsContainer}>
          {FORM_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: option.bg, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => router.push(option.href)}
              testID={`form-option-${option.id}`}
            >
              <View style={[styles.iconWrap, { backgroundColor: option.accent + "22" }]}>
                <Text style={styles.icon}>{option.icon}</Text>
              </View>
              <Text style={[styles.cardLabel, { color: option.accent }]}>{option.label}</Text>
              <Text style={styles.cardDesc}>{option.description}</Text>
              <View style={[styles.cardArrow, { backgroundColor: option.accent }]}>
                <Text style={styles.cardArrowText}>→</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a365d" },
  scroll: { flex: 1, backgroundColor: "#f0f4f8" },
  content: { paddingBottom: 24 },

  header: {
    backgroundColor: "#1a365d",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 16,
  },
  backText: {
    color: "#90cdf4",
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 14,
    color: "#bee3f8",
    marginTop: 4,
  },

  cardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  icon: {
    fontSize: 22,
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: "#718096",
    marginBottom: 12,
    lineHeight: 18,
  },
  cardArrow: {
    alignSelf: "flex-end",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  cardArrowText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
