import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

export default function CaseStudyFormDetail() {
  // For now, just a placeholder — viewing existing forms
  const { id } = useLocalSearchParams();
  const router = useRouter();
  useEffect(() => {
    router.replace("/case-study-form/new");
  }, []);
  return null;
}
