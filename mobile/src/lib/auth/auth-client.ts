import { createAuthClient } from "better-auth/react";
import { expoClient, setupExpoOnlineManager } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

// Hermes can't run dynamic import() inside ExpoOnlineManager.setup().
// Call setupExpoOnlineManager() to ensure the instance is created, then
// replace setup() with a no-op before createAuthClient triggers it.
const _mgr = setupExpoOnlineManager();
_mgr.setup = () => () => {};

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
