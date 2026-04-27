"use client";

import { usePathname } from "next/navigation";
import NavBar from "./navBar";
import { useEffect, useState } from "react";

export default function NavWrapper() {
  const pathname = usePathname();

  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.remove("light", "dark");
document.documentElement.classList.add(saved || "dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";

    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    document.documentElement.classList.remove("light", "dark");
document.documentElement.classList.add(newTheme);
  };

  return (
  <>
    {pathname !== "/" &&
     pathname !== "/signup" &&
     pathname !== "/login" && (
      <NavBar toggleTheme={toggleTheme} theme={theme} />
    )}
  </>
);
}