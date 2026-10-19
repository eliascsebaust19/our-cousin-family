"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Wifi, WifiOff } from "lucide-react";

export function PwaRegister() {
  useEffect(() => {
    // 1. Service Worker registration
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            registration.update();
          })
          .catch((err) => {
            console.error("Service Worker registration failed:", err);
          });
      });
    }

    // 2. Network connectivity listeners
    const handleOnline = () => {
      toast.success("You are back online!", {
        icon: <Wifi className="size-4 text-emerald-600" />,
        duration: 3000,
      });
    };

    const handleOffline = () => {
      toast.warning("You are currently offline. Cached pages remain available.", {
        icon: <WifiOff className="size-4 text-amber-600" />,
        duration: 5000,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return null;
}

