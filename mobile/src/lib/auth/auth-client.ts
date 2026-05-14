import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

// Hermes doesn't support dynamic import() — replace ExpoOnlineManager.setup with a no-op.
const kOnlineManager = Symbol.for("better-auth:online-manager");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onlineMgr = (globalThis as any)[kOnlineManager];
if (onlineMgr) onlineMgr.setup = () => () => {};

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL! as string,
  plugins: [
    expoClient({
      scheme: "vibecode",
      storagePrefix: "vibecode",
      storage: SecureStore,
    }),
  ],
});
