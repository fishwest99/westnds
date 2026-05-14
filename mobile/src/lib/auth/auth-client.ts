import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

// Build the plugin first — this forces @better-auth/expo/client to load and
// register ExpoOnlineManager in globalThis. Then override its setup() before
// createAuthClient runs, because Hermes doesn't support dynamic import().
const expoPlugin = expoClient({
  scheme: "vibecode",
  storagePrefix: "vibecode",
  storage: SecureStore,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onlineMgr = (globalThis as any)[Symbol.for("better-auth:online-manager")];
if (onlineMgr) onlineMgr.setup = () => () => {};

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL! as string,
  plugins: [expoPlugin],
});
