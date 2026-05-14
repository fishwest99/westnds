import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { authClient } from "@/lib/auth/auth-client";
import { useInvalidateSession } from "@/lib/auth/use-session";

export default function SignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
      } else {
        result = await authClient.signUp.email({ email: email.trim(), password, name: name.trim() });
      }
      if (result.error) {
        Alert.alert("Error", result.error.message ?? "Authentication failed");
      } else {
        await invalidateSession();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>West NDx</Text>
          <Text style={styles.subtitle}>Intraoperative Neuromonitoring</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>{mode === "signin" ? "Sign In" : "Create Account"}</Text>
          {mode === "signup" && (
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
          )}
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
          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading} testID="submit-button">
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{mode === "signin" ? "Sign In" : "Create Account"}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setName(""); setEmail(""); setPassword(""); }}
            testID="toggle-mode-button"
          >
            <Text style={styles.toggleText}>
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <Text style={styles.toggleLink}>{mode === "signin" ? "Sign Up" : "Sign In"}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 32 },
  logo: { fontSize: 32, fontWeight: "700", color: "#1a365d", letterSpacing: 1 },
  subtitle: { fontSize: 14, color: "#4a5568", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  title: { fontSize: 22, fontWeight: "700", color: "#1a365d", marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#4a5568", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: "#f8fafc", color: "#1a202c" },
  button: { backgroundColor: "#2b6cb0", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  toggle: { marginTop: 16, alignItems: "center" },
  toggleText: { fontSize: 14, color: "#718096" },
  toggleLink: { color: "#2b6cb0", fontWeight: "600" },
});
