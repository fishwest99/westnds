import React, { useRef, useState } from "react";
import { View, PanResponder, StyleSheet, TouchableOpacity, Text, Image } from "react-native";
import { Svg, Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

type Props = {
  value: string;
  onChange: (dataUri: string) => void;
  height?: number;
};

export function SignaturePad({ value, onChange, height = 140 }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [showPreview, setShowPreview] = useState<boolean>(!!value);
  const padRef = useRef<View>(null);
  const currentPathRef = useRef<string>("");
  const pathsRef = useRef<string[]>([]);

  const capture = async () => {
    if (!padRef.current || pathsRef.current.length === 0) return;
    try {
      const base64 = await captureRef(padRef, { format: "png", result: "base64" });
      onChange("data:image/png;base64," + base64);
    } catch (e) {
      console.error("Signature capture failed:", e);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const p = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        currentPathRef.current = p;
        setCurrentPath(p);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const p = `${currentPathRef.current} L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        currentPathRef.current = p;
        setCurrentPath(p);
      },
      onPanResponderRelease: () => {
        if (!currentPathRef.current) return;
        pathsRef.current = [...pathsRef.current, currentPathRef.current];
        setPaths([...pathsRef.current]);
        currentPathRef.current = "";
        setCurrentPath("");
        capture();
      },
    })
  ).current;

  const handleClear = () => {
    pathsRef.current = [];
    setPaths([]);
    currentPathRef.current = "";
    setCurrentPath("");
    setShowPreview(false);
    onChange("");
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
      <View
        ref={padRef}
        style={[styles.pad, { height }]}
        {...panResponder.panHandlers}
        collapsable={false}
      >
        <Svg height={height} width="100%" style={StyleSheet.absoluteFill}>
          {paths.map((p, i) => (
            <Path
              key={i}
              d={p}
              stroke="#1a365d"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPath ? (
            <Path
              d={currentPath}
              stroke="#1a365d"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
        {paths.length === 0 && !currentPath ? (
          <Text style={styles.placeholder}>Draw your signature here</Text>
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
  },
  placeholder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: "center",
    textAlignVertical: "center",
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
