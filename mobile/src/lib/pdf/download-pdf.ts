import { Platform } from "react-native";
import { File as FSFile, Paths } from "expo-file-system";
import { authClient } from "@/lib/auth/auth-client";

type DownloadArgs = {
  url: string;
  filename: string;
};

export const downloadPdfToFile = async ({
  url,
  filename,
}: DownloadArgs): Promise<string | null> => {
  if (Platform.OS === "web") {
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) return null;
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      return blobUrl;
    } catch {
      return null;
    }
  }

  const token = authClient.getCookie();
  const destination = new FSFile(Paths.cache, filename);
  try {
    const result = await FSFile.downloadFileAsync(url, destination, {
      headers: { Cookie: token },
      idempotent: true,
    });
    return result.uri;
  } catch {
    return null;
  }
};

export const isWebPlatform = () => Platform.OS === "web";
