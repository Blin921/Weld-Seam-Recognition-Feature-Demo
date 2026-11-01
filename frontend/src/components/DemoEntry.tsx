"use client";
import { useRouter } from "next/navigation";
import { setDemoMode } from "@/lib/demo";
export default function DemoEntry() {
  const router = useRouter();
  return (
    <button
      className="demo-entry"
      onClick={() => {
        setDemoMode(true);
        router.push("/recognize");
      }}
    >
      体验演示数据 →
    </button>
  );
}
