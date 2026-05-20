import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Text, Image } from "react-native";

type Props = {
  value: string;
  onChange: (dataUri: string) => void;
  height?: number;
};

export function SignaturePad({ value, onChange, height = 140 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [showPreview, setShowPreview] = useState<boolean>(!!value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (showPreview) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "#1a365d";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, [showPreview, height]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawingRef.current = true;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const dataUrl = canvasRef.current?.toDataURL("image/png");
    if (dataUrl) onChangeRef.current(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
    setShowPreview(false);
    onChangeRef.current("");
  };

  if (showPreview && value) {
    return (
      <View style={styles.wrapper}>
        <Image
          source={{ uri: value }}
          style={{ height, width: "100%", backgroundColor: "#fff" }}
          resizeMode="contain"
        />
        <View style={styles.footer}>
          <Text style={styles.signLine}>✗ _______________________</Text>
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clearText}>Clear & Redraw</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.pad, { height }]}>
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: `${height}px`,
            touchAction: "none",
            cursor: "crosshair",
            backgroundColor: "#fff",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!hasDrawn ? (
          <Text style={styles.placeholder} pointerEvents="none">Draw your signature here</Text>
        ) : null}
      </View>
      <View style={styles.footer}>
        <Text style={styles.signLine}>✗ _______________________</Text>
        <TouchableOpacity onPress={handleClear}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1.5,
    borderColor: "#cbd5e0",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  pad: {
    backgroundColor: "#fff",
    position: "relative",
  },
  placeholder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: "center",
    color: "#a0aec0",
    fontSize: 14,
    paddingTop: 50,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  signLine: {
    color: "#a0aec0",
    fontSize: 13,
  },
  clearText: {
    color: "#e53e3e",
    fontSize: 13,
    fontWeight: "600",
  },
});
