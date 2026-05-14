import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as MailComposer from "expo-mail-composer";

type Phase = "camera" | "review" | "done";

export default function HpScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("camera");
  const [photos, setPhotos] = useState<{ uri: string; base64: string }[]>([]);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const takePhoto = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.75, base64: true });
    if (photo?.base64) {
      setPhotos(prev => [...prev, { uri: photo.uri, base64: photo.base64! }]);
    }
  };

  const generatePdf = async () => {
    setGenerating(true);
    try {
      const pages = photos.map((p, i) =>
        `<div style="page-break-after:${i < photos.length - 1 ? "always" : "avoid"};margin:0;padding:0;">
          <img src="data:image/jpeg;base64,${p.base64}" style="width:100%;height:auto;display:block;" />
        </div>`
      ).join("");
      const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;}img{width:100%;height:auto;display:block;}</style></head><body>${pages}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
      setPdfUri(uri);
      setPhase("done");
    } finally {
      setGenerating(false);
    }
  };

  const sharePdf = async () => {
    if (!pdfUri) return;
    await Sharing.shareAsync(pdfUri, { mimeType: "application/pdf", dialogTitle: "Share H&P Document", UTI: "com.adobe.pdf" });
  };

  const emailPdf = async () => {
    if (!pdfUri) return;
    const available = await MailComposer.isAvailableAsync();
    if (!available) { await sharePdf(); return; }
    await MailComposer.composeAsync({
      subject: `H&P Document – ${new Date().toLocaleDateString()}`,
      body: "Please find the H&P document attached.",
      attachments: [pdfUri],
    });
  };

  // Permission screen
  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-button">
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>H&P Scan</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>Allow camera access to scan documents.</Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission} testID="request-permission-button">
            <Text style={styles.permissionBtnText}>Allow Camera</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Camera phase */}
      {phase === "camera" ? (
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
            {/* top overlay */}
            <SafeAreaView edges={["top"]} style={styles.cameraHeader}>
              <Pressable onPress={() => router.back()} testID="back-button">
                <Text style={styles.cameraBackText}>← Back</Text>
              </Pressable>
              <Text style={styles.cameraTitleText}>H&P Scan</Text>
              {photos.length > 0 ? (
                <View style={styles.pageCountBadge}>
                  <Text style={styles.pageCountText}>{photos.length} pg</Text>
                </View>
              ) : <View style={{ width: 52 }} />}
            </SafeAreaView>
            {/* bottom controls */}
            <View style={styles.cameraControls}>
              <View style={{ width: 72 }} />
              <Pressable style={styles.captureBtn} onPress={takePhoto} testID="capture-button">
                <View style={styles.captureBtnInner} />
              </Pressable>
              {photos.length > 0 ? (
                <Pressable style={styles.reviewBtn} onPress={() => setPhase("review")} testID="review-button">
                  <Text style={styles.reviewBtnText}>Review →</Text>
                </Pressable>
              ) : <View style={{ width: 72 }} />}
            </View>
          </CameraView>
        </View>
      ) : null}

      {/* Review phase */}
      {phase === "review" ? (
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.header}>
            <Pressable onPress={() => setPhase("camera")} style={styles.backBtn} testID="back-to-camera-button">
              <Text style={styles.backText}>← Camera</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Review Pages</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView contentContainerStyle={styles.reviewContent}>
            <Text style={styles.reviewPageCount}>{photos.length} page{photos.length !== 1 ? "s" : ""} captured</Text>
            <View style={styles.photoGrid}>
              {photos.map((p, i) => (
                <View key={i} style={styles.photoThumbWrap} testID={`photo-thumb-${i}`}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumb} resizeMode="cover" />
                  <View style={styles.pageNumBadge}>
                    <Text style={styles.pageNumText}>{i + 1}</Text>
                  </View>
                  <Pressable
                    style={styles.removePhotoBtn}
                    onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    testID={`remove-photo-${i}`}
                  >
                    <Text style={styles.removePhotoBtnText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            <Pressable style={styles.addPageBtn} onPress={() => setPhase("camera")} testID="add-page-button">
              <Text style={styles.addPageBtnText}>+ Add More Pages</Text>
            </Pressable>
            <Pressable
              style={[styles.generateBtn, (generating || photos.length === 0) && styles.generateBtnDisabled]}
              onPress={generatePdf}
              disabled={generating || photos.length === 0}
              testID="generate-pdf-button"
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.generateBtnText}>Generate PDF</Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      ) : null}

      {/* Done phase */}
      {phase === "done" ? (
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.header}>
            <Pressable onPress={() => { setPhotos([]); setPdfUri(null); setPhase("camera"); }} style={styles.backBtn} testID="scan-again-button">
              <Text style={styles.backText}>← New Scan</Text>
            </Pressable>
            <Text style={styles.headerTitle}>H&P Document</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.doneContent}>
            <View style={styles.doneIconWrap}>
              <Text style={styles.doneIcon}>✅</Text>
            </View>
            <Text style={styles.doneTitle}>PDF Ready</Text>
            <Text style={styles.doneSub}>{photos.length} page{photos.length !== 1 ? "s" : ""} · H&P Document</Text>
            <View style={styles.doneActions}>
              <Pressable style={styles.shareBtn} onPress={sharePdf} testID="share-pdf-button">
                <Text style={styles.shareBtnText}>Share PDF</Text>
              </Pressable>
              <Pressable style={styles.emailBtn} onPress={emailPdf} testID="email-pdf-button">
                <Text style={styles.emailBtnText}>Send by Email</Text>
              </Pressable>
            </View>
            <Pressable style={styles.scanAgainLink} onPress={() => { setPhotos([]); setPdfUri(null); setPhase("camera"); }} testID="scan-again-link">
              <Text style={styles.scanAgainText}>Scan Another Document</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f0f4f8" },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#1a365d", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 70 },
  backText: { color: "#90cdf4", fontSize: 15, fontWeight: "600" },
  headerTitle: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },

  permissionContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  permissionIcon: { fontSize: 56, marginBottom: 20 },
  permissionTitle: { fontSize: 22, fontWeight: "800", color: "#1a365d", marginBottom: 10 },
  permissionText: { fontSize: 15, color: "#718096", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  permissionBtn: { backgroundColor: "#2d3748", borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  permissionBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Camera UI
  cameraHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.35)" },
  cameraBackText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cameraTitleText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  pageCountBadge: { backgroundColor: "#2d3748", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, minWidth: 52, alignItems: "center" },
  pageCountText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cameraControls: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingBottom: 48, paddingTop: 16, backgroundColor: "rgba(0,0,0,0.4)" },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.25)", borderWidth: 3, borderColor: "#fff", justifyContent: "center", alignItems: "center" },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
  reviewBtn: { backgroundColor: "#2d3748", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  reviewBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Review
  reviewContent: { padding: 16, paddingBottom: 40 },
  reviewPageCount: { fontSize: 15, fontWeight: "700", color: "#4a5568", marginBottom: 14, textAlign: "center" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  photoThumbWrap: { width: "47%", aspectRatio: 0.75, borderRadius: 10, overflow: "hidden", position: "relative", backgroundColor: "#e2e8f0" },
  photoThumb: { width: "100%", height: "100%" },
  pageNumBadge: { position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  pageNumText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  removePhotoBtn: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  removePhotoBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  addPageBtn: { borderWidth: 2, borderColor: "#2d3748", borderStyle: "dashed", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 14 },
  addPageBtnText: { color: "#2d3748", fontSize: 15, fontWeight: "700" },
  generateBtn: { backgroundColor: "#2d3748", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  generateBtnDisabled: { backgroundColor: "#a0aec0" },
  generateBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Done
  doneContent: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  doneIconWrap: { width: 88, height: 88, borderRadius: 24, backgroundColor: "#c6f6d5", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  doneIcon: { fontSize: 44 },
  doneTitle: { fontSize: 26, fontWeight: "800", color: "#1a365d", marginBottom: 6 },
  doneSub: { fontSize: 15, color: "#718096", marginBottom: 36 },
  doneActions: { width: "100%", gap: 12 },
  shareBtn: { backgroundColor: "#2d3748", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  shareBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  emailBtn: { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 2, borderColor: "#2d3748" },
  emailBtnText: { color: "#2d3748", fontSize: 16, fontWeight: "700" },
  scanAgainLink: { marginTop: 20 },
  scanAgainText: { color: "#2b6cb0", fontSize: 14, fontWeight: "600" },
});
