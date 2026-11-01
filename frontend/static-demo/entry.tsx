import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import Home from "../src/app/page";
import WorkspaceShell from "../src/components/WorkspaceShell";
import { usePathname } from "./navigation";
function StaticDemo() {
  const path = usePathname();
  useEffect(() => {
    const scrollToFeature = () => {
      if (location.hash.endsWith("#features"))
        document
          .getElementById("features")
          ?.scrollIntoView({ behavior: "smooth" });
    };
    scrollToFeature();
    window.addEventListener("hashchange", scrollToFeature);
    return () => window.removeEventListener("hashchange", scrollToFeature);
  }, [path]);
  return <WorkspaceShell>{path === "/" ? <Home /> : null}</WorkspaceShell>;
}
createRoot(document.getElementById("root")!).render(<StaticDemo />);
