import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/api";

type Company = {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string;
  fax: string;
  ein: string;
};

type Draft = { name: string; address: string; phone: string; fax: string; ein: string };

const blankDraft = (c?: Company): Draft => ({
  name: c?.name ?? "",
  address: c?.address ?? "",
  phone: c?.phone ?? "",
  fax: c?.fax ?? "",
  ein: c?.ein ?? "",
});

export default function CompanySettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => api.get<{ isManager: boolean; isOwner: boolean; roleLabel: string }>("/api/time-off/my-profile"),
    staleTime: 1000 * 60 * 5,
  });
  const isManager = profile?.isManager === true;

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api.get<Company[]>("/api/companies"),
  });

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!companies) return;
    setDrafts((prev) => {
      const next: Record<string, Draft> = { ...prev };
      for (const c of companies) {
        if (!next[c.id]) next[c.id] = blankDraft(c);
      }
      return next;
    });
  }, [companies]);

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Draft }) =>
      api.put<Company>(`/api/companies/${id}`, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setSavedId(vars.id);
      setTimeout(() => setSavedId((cur) => (cur === vars.id ? null : cur)), 1800);
    },
    onSettled: () => setSavingId(null),
  });

  const handleSave = (id: string) => {
    const d = drafts[id];
    if (!d) return;
    setSavingId(id);
    updateMut.mutate({ id, data: d });
  };

  const update = (id: string, key: keyof Draft, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? blankDraft()), [key]: value } }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="company-settings-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
            <Text style={styles.backText}>← Home</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Company Settings</Text>
          <Text style={styles.headerSub}>Used on every PDF report header</Text>
        </View>

        {!isManager ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>Managers Only</Text>
            <Text style={styles.errorBody}>
              You don't have permission to edit company info. Please contact a manager.
            </Text>
          </View>
        ) : isLoading || !companies ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#1a365d" />
          </View>
        ) : (
          companies.map((c) => {
            const d = drafts[c.id] ?? blankDraft(c);
            const isSaving = savingId === c.id;
            const justSaved = savedId === c.id;
            return (
              <View key={c.id} style={styles.card} testID={`company-card-${c.slug}`}>
                <Text style={styles.cardTitle}>{c.name || "Unnamed Company"}</Text>
                <Text style={styles.cardSub}>Slug: {c.slug}</Text>

                <Text style={styles.label}>Company Name</Text>
                <TextInput
                  style={styles.input}
                  value={d.name}
                  onChangeText={(v) => update(c.id, "name", v)}
                  placeholder="e.g. West Neurodiagnostic Services"
                  testID={`${c.slug}-name-input`}
                />

                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={styles.input}
                  value={d.address}
                  onChangeText={(v) => update(c.id, "address", v)}
                  placeholder="Street, City, State ZIP"
                  testID={`${c.slug}-address-input`}
                />

                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={d.phone}
                  onChangeText={(v) => update(c.id, "phone", v)}
                  placeholder="(555) 555-5555"
                  keyboardType="phone-pad"
                  testID={`${c.slug}-phone-input`}
                />

                <Text style={styles.label}>Fax</Text>
                <TextInput
                  style={styles.input}
                  value={d.fax}
                  onChangeText={(v) => update(c.id, "fax", v)}
                  placeholder="(555) 555-5555"
                  keyboardType="phone-pad"
                  testID={`${c.slug}-fax-input`}
                />

                <Text style={styles.label}>EIN #</Text>
                <TextInput
                  style={styles.input}
                  value={d.ein}
                  onChangeText={(v) => update(c.id, "ein", v)}
                  placeholder="XX-XXXXXXX"
                  testID={`${c.slug}-ein-input`}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.saveBtn,
                    pressed && { opacity: 0.85 },
                    isSaving && { opacity: 0.7 },
                  ]}
                  onPress={() => handleSave(c.id)}
                  disabled={isSaving}
                  testID={`${c.slug}-save-button`}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {justSaved ? "✓ Saved" : "Save Changes"}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a365d" },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  header: {
    backgroundColor: "#1a365d",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 20,
  },
  backBtn: { marginBottom: 12 },
  backText: { color: "#90cdf4", fontSize: 14, fontWeight: "600" },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  headerSub: { fontSize: 13, color: "#bee3f8", marginTop: 6 },
  loadingWrap: { paddingVertical: 40, alignItems: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#1a365d", marginBottom: 2 },
  cardSub: { fontSize: 11, color: "#a0aec0", marginBottom: 16, letterSpacing: 0.4, textTransform: "uppercase" },
  label: { fontSize: 11, fontWeight: "700", color: "#4a5568", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#f8fafc",
    color: "#1a202c",
    marginBottom: 14,
  },
  saveBtn: {
    backgroundColor: "#1a365d",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#e53e3e", marginBottom: 6 },
  errorBody: { fontSize: 14, color: "#4a5568", lineHeight: 20 },
});
