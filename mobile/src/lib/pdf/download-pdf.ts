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

type ShareArgs = {
  url: string;
  filename: string;
  title?: string;
  text?: string;
};

export type WebShareResult = "shared" | "downloaded" | "cancelled" | "failed";

export const sharePdfOnWeb = async ({
  url,
  filename,
  title,
  text,
}: ShareArgs): Promise<WebShareResult> => {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return "failed";
    const blob = await response.blob();

    const nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav && typeof nav.share === "function") {
      try {
        const file = new File([blob], filename, { type: "application/pdf" });
        const shareData: ShareData = { files: [file], title, text };
        const canShare = typeof nav.canShare === "function" ? nav.canShare(shareData) : true;
        if (canShare) {
          await nav.share(shareData);
          return "shared";
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return "cancelled";
      }
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return "downloaded";
  } catch {
    return "failed";
  }
};
