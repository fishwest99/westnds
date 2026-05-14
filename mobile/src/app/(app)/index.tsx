import React, { useRef } from "react";
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
import { authClient } from "@/lib/auth/auth-client";
import { useInvalidateSession, useSession } from "@/lib/auth/use-session";
import { api } from "@/lib/api/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type OnCallEntry = { id: string; techName: string; date: string; notes: string };

const OWNER_EMAIL = "west_nds@yahoo.com";

const toDateStr = (d: Date) => d.toISOString().split("T")[0];

const getWeekRange = () => {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
};

const formatShortDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const TILES = [
  {
    id: "new-case",
    label: "Start New Case",
    icon: "＋",
    description: "Begin a new consent form",
    href: "/consent-form/new" as const,
    accent: "#2b6cb0",
    bg: "#ebf4ff",
  },
  {
    id: "cases",
    label: "Previous Cases",
    icon: "📋",
    description: "View & edit existing cases",
    href: "/cases" as const,
    accent: "#276749",
    bg: "#e6ffef",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "📅",
    description: "Upcoming procedures",
    href: "/calendar" as const,
    accent: "#6b46c1",
    bg: "#f3eeff",
  },
  {
    id: "on-call",
    label: "On-Call Schedule",
    icon: "📞",
    description: "Weekly rotation",
    href: "/on-call" as const,
    accent: "#c05621",
    bg: "#fff5eb",
  },
  {
    id: "time-off",
    label: "Time Off Requests",
    icon: "🏖",
    description: "Submit & manage requests",
    href: "/time-off" as const,
    accent: "#b7791f",
    bg: "#fffff0",
  },
  {
    id: "time-tracking",
    label: "Time Tracking",
    icon: "⏱",
    description: "Log hours & view reports",
    href: "/time-tracking" as const,
    accent: "#2c7a7b",
    bg: "#e6fffa",
  },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const invalidateSession = useInvalidateSession();
  const queryClient = useQueryClient();
  const logoTapCount = useRef(0);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userEmail = session?.user?.email ?? "";
  const isOwner = userEmail === OWNER_EMAIL;

  const handleSignOut = async () => {
    await authClient.signOut();
    await invalidateSession();
  };

  const handleLogoTap = async () => {
    logoTapCount.current += 1;
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
    logoTapTimer.current = setTimeout(() => {
      logoTapCount.current = 0;
    }, 1500);

    if (logoTapCount.current >= 5) {
      logoTapCount.current = 0;
      if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
      try {
        const result = await api.post<{ isManager: boolean }>("/api/time-off/toggle-manager", {});
        const status = result?.isManager ? "Manager" : "Technician";
        queryClient.invalidateQueries({ queryKey: ["session"] });
        console.log(`Role toggled: now ${status}`);
      } catch (e) {
        console.error("Toggle manager failed", e);
      }
    }
  };

  const userName = session?.user?.name ?? "there";
  const firstName = userName.split(" ")[0];

  const { data: onCallEntries } = useQuery({
    queryKey: ["on-call"],
    queryFn: () => api.get<OnCallEntry[]>("/api/on-call"),
    staleTime: 1000 * 60 * 5,
  });

  const { data: roleRequests } = useQuery({
    queryKey: ["role-requests"],
    queryFn: () => api.get<{ id: string; userName: string; requestedRole: string }[]>("/api/role-requests"),
    enabled: isOwner,
    staleTime: 1000 * 60 * 2,
  });
  const pendingRoleCount = roleRequests?.length ?? 0;

  const { monday, sunday } = getWeekRange();
  const monStr = toDateStr(monday);
  const sunStr = toDateStr(sunday);

  const myOnCallDays = (onCallEntries ?? []).filter(
    (e) => e.techName === userName && e.date >= monStr && e.date <= sunStr
  );
  const isOnCallThisWeek = myOnCallDays.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a365d" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="home-screen"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleLogoTap} testID="logo-button">
            <Text style={styles.orgName}>West NDx</Text>
            <Text style={styles.orgSub}>Intraoperative Neuromonitoring</Text>
          </Pressable>
          <Pressable onPress={handleSignOut} style={styles.signOutBtn} testID="sign-out-button">
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeGreeting}>Welcome back,</Text>
          <Text style={styles.welcomeName}>{firstName}</Text>
          <Text style={styles.welcomeSub}>What would you like to do today?</Text>
        </View>

        {/* On-Call Banner */}
        {isOnCallThisWeek ? (
          <Pressable
            style={({ pressed }) => [styles.onCallBanner, pressed && { opacity: 0.9 }]}
            onPress={() => router.push("/on-call")}
            testID="on-call-banner"
          >
            <View style={styles.onCallLeft}>
              <View style={styles.onCallIconWrap}>
                <Text style={styles.onCallIcon}>📞</Text>
              </View>
              <View>
                <Text style={styles.onCallTitle}>You're On Call This Week</Text>
                <Text style={styles.onCallDates}>
                  {myOnCallDays.map((e) => formatShortDate(e.date)).join("  ·  ")}
                </Text>
              </View>
            </View>
            <Text style={styles.onCallArrow}>→</Text>
          </Pressable>
        ) : null}

        {/* Role Requests Banner (owner only) */}
        {isOwner && pendingRoleCount > 0 ? (
          <Pressable
            style={({ pressed }) => [styles.roleRequestBanner, pressed && { opacity: 0.9 }]}
            onPress={() => router.push("/role-requests")}
            testID="role-requests-banner"
          >
            <View style={styles.roleRequestLeft}>
              <View style={styles.roleRequestIconWrap}>
                <Text style={styles.roleRequestIcon}>👤</Text>
              </View>
              <View>
                <Text style={styles.roleRequestTitle}>
                  {pendingRoleCount} Pending Role {pendingRoleCount === 1 ? "Request" : "Requests"}
                </Text>
                <Text style={styles.roleRequestSub}>Tap to review and approve</Text>
              </View>
            </View>
            <Text style={styles.roleRequestArrow}>→</Text>
          </Pressable>
        ) : null}

        {/* Tiles */}
        <View style={styles.tilesGrid}>
          {TILES.map((tile) => (
            <Pressable
              key={tile.id}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: tile.bg, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => router.push(tile.href)}
              testID={`tile-${tile.id}`}
            >
              <View style={[styles.tileIconWrap, { backgroundColor: tile.accent + "22" }]}>
                <Text style={styles.tileIcon}>{tile.icon}</Text>
              </View>
              <Text style={[styles.tileLabel, { color: tile.accent }]}>{tile.label}</Text>
              <Text style={styles.tileDesc}>{tile.description}</Text>
              <View style={[styles.tileArrow, { backgroundColor: tile.accent }]}>
                <Text style={styles.tileArrowText}>→</Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#1a365d",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  orgName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  orgSub: {
    fontSize: 11,
    color: "#90cdf4",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  signOutBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  signOutText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  welcomeCard: {
    backgroundColor: "#1a365d",
    paddingHorizontal: 20,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 24,
  },
  welcomeGreeting: {
    fontSize: 16,
    color: "#90cdf4",
    fontWeight: "500",
  },
  welcomeName: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    marginTop: 2,
  },
  welcomeSub: {
    fontSize: 14,
    color: "#bee3f8",
    marginTop: 6,
  },

  tilesGrid: {
    paddingHorizontal: 16,
    gap: 12,
  },
  tile: {
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  tileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  tileIcon: {
    fontSize: 22,
  },
  tileLabel: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  tileDesc: {
    fontSize: 13,
    color: "#718096",
    marginBottom: 12,
  },
  tileArrow: {
    alignSelf: "flex-end",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  tileArrowText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  onCallBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#c05621",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#c05621",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  onCallLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  onCallIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  onCallIcon: { fontSize: 20 },
  onCallTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  onCallDates: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
  },
  onCallArrow: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 8,
  },

  roleRequestBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#2b6cb0",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#2b6cb0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  roleRequestLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  roleRequestIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  roleRequestIcon: { fontSize: 20 },
  roleRequestTitle: { fontSize: 15, fontWeight: "700", color: "#fff", marginBottom: 2 },
  roleRequestSub: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: "500" },
  roleRequestArrow: { color: "#fff", fontSize: 18, fontWeight: "700", marginLeft: 8 },
});
