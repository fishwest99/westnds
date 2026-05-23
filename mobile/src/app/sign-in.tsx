import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "@/lib/auth/auth-client";
import { useInvalidateSession } from "@/lib/auth/use-session";
import { api } from "@/lib/api/api";

export default function SignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestedRole, setRequestedRole] = useState<"technician" | "manager">("technician");
  const [managerPendingMsg, setManagerPendingMsg] = useState(false);
  const invalidateSession = useInvalidateSession();

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }
    setLoading(true);
    try {
      let result;
      if (mode === "signin") {
        result = await authClient.signIn.email({ email: email.trim(), password });
        if (result.error) {
          Alert.alert("Error", result.error.message ?? "Authentication failed");
        } else {
          await invalidateSession();
        }
      } else {
        result = await authClient.signUp.email({ email: email.trim(), password, name: name.trim() });
        if (result.error) {
          Alert.alert("Error", result.error.message ?? "Authentication failed");
        } else {
          // Post role request silently
          try {
            await api.post("/api/role-requests", { requestedRole });
          } catch {
            // silent — non-critical
          }

          if (requestedRole === "manager") {
            // Show inline pending message and let user sign in
            await invalidateSession();
            setManagerPendingMsg(true);
            setMode("signin");
            setName("");
            setEmail("");
            setPassword("");
            setRequestedRole("technician");
          } else {
            await invalidateSession();
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setName("");
    setEmail("");
    setPassword("");
    setRequestedRole("technician");
    setManagerPendingMsg(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.header}>
          <Text style={styles.logo}>West NDx</Text>
          <Text style={styles.subtitle}>Intraoperative Neuromonitoring</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>{mode === "signin" ? "Sign In" : "Create Account"}</Text>

          {managerPendingMsg ? (
            <View style={styles.pendingCard} testID="manager-pending-message">
              <Text style={styles.pendingSuccess}>Account created!</Text>
              <Text style={styles.pendingNote}>
                Your manager access request is pending approval by the app owner.
              </Text>
            </View>
          ) : null}

          {mode === "signup" ? (
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                autoCapitalize="words"
                testID="name-input"
              />
            </View>
          ) : null}

          {mode === "signup" ? (
            <View style={styles.field}>
              <Text style={styles.label}>Role</Text>
              <View style={styles.roleRow}>
                <Pressable
                  style={[
                    styles.roleCard,
                    requestedRole === "technician" && styles.roleCardSelected,
                  ]}
                  onPress={() => setRequestedRole("technician")}
                  testID="role-technician"
                >
                  <Text style={[styles.roleCardTitle, requestedRole === "technician" && styles.roleCardTitleSelected]}>
                    Technician
                  </Text>
                  <Text style={[styles.roleCardDesc, requestedRole === "technician" && styles.roleCardDescSelected]}>
                    Clinical staff
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.roleCard,
                    requestedRole === "manager" && styles.roleCardSelected,
                  ]}
                  onPress={() => setRequestedRole("manager")}
                  testID="role-manager"
                >
                  <Text style={[styles.roleCardTitle, requestedRole === "manager" && styles.roleCardTitleSelected]}>
                    Manager
                  </Text>
                  <Text style={[styles.roleCardDesc, requestedRole === "manager" && styles.roleCardDescSelected]}>
                    Approve requests
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              testID="email-input"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              testID="password-input"
            />
          </View>
          <Pressable
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
            testID="submit-button"
            accessibilityRole="button"
            accessibilityLabel={mode === "signin" ? "Sign In" : "Create Account"}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.toggle}
            onPress={handleToggleMode}
            testID="toggle-mode-button"
          >
            <Text style={styles.toggleText}>
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <Text style={styles.toggleLink}>{mode === "signin" ? "Sign Up" : "Sign In"}</Text>
            </Text>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 40, paddingBottom: 120 },
  header: { alignItems: "center", marginBottom: 32 },
  logo: { fontSize: 32, fontWeight: "700", color: "#1a365d", letterSpacing: 1 },
  subtitle: { fontSize: 14, color: "#4a5568", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  title: { fontSize: 22, fontWeight: "700", color: "#1a365d", marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#4a5568", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: "#f8fafc", color: "#1a202c" },
  button: {
    backgroundColor: "#2b6cb0",
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    minHeight: 56,
    width: "100%",
  },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: 0.5 },
  toggle: { marginTop: 16, alignItems: "center" },
  toggleText: { fontSize: 14, color: "#718096" },
  toggleLink: { color: "#2b6cb0", fontWeight: "600" },

  roleRow: { flexDirection: "row", gap: 10 },
  roleCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  roleCardSelected: {
    borderColor: "#2b6cb0",
    backgroundColor: "#ebf4ff",
  },
  roleCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#718096",
    marginBottom: 4,
  },
  roleCardTitleSelected: {
    color: "#2b6cb0",
  },
  roleCardDesc: {
    fontSize: 12,
    color: "#a0aec0",
  },
  roleCardDescSelected: {
    color: "#4a90d9",
  },

  pendingCard: {
    backgroundColor: "#f0fff4",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#9ae6b4",
  },
  pendingSuccess: {
    fontSize: 15,
    fontWeight: "700",
    color: "#276749",
    marginBottom: 4,
  },
  pendingNote: {
    fontSize: 13,
    color: "#2b6cb0",
    lineHeight: 19,
  },
});
