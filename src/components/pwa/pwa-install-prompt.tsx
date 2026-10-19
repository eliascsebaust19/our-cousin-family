"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Check,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type PwaContextType = {
  isInstallable: boolean;
  isInstalled: boolean;
  isMobile: boolean;
  promptInstall: () => Promise<void>;
  openGuide: () => void;
};

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  isInstalled: false,
  isMobile: false,
  promptInstall: async () => {},
  openGuide: () => {},
});

export function usePwaInstall() {
  return useContext(PwaContext);
}

const DISMISS_KEY = "ocf_pwa_dismissed_until";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"android" | "ios">("android");

  useEffect(() => {
    // 1. Check if running in standalone mode (already installed as PWA)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes("android-app://");
    setIsInstalled(isStandalone);

    // 2. Device & OS detection
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isMobileDevice =
      isIosDevice ||
      /android|webos|blackberry|iemobile|opera mini/i.test(ua) ||
      window.innerWidth <= 768;

    setIsIos(isIosDevice);
    setIsMobile(isMobileDevice);
    setActiveTab(isIosDevice ? "ios" : "android");

    // 3. Check 24-hour snooze dismissal from localStorage
    try {
      const dismissedUntil = localStorage.getItem(DISMISS_KEY);
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }

    // 4. Listen for native browser install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setGuideOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const openGuide = useCallback(() => {
    setGuideOpen(true);
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
        return;
      } catch {
        // Fall back to guide if prompt threw
      }
    }
    // If native prompt is not available (e.g. iOS Safari, Chrome heuristics, etc.)
    setGuideOpen(true);
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      // Snooze for 24 hours
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    } catch {}
  };

  // Check if current route has the bottom navigation bar
  const hasBottomNav =
    pathname !== "/" &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/signup") &&
    !pathname.startsWith("/forgot-password") &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/join");

  // Show floating widget if not installed, not dismissed, and on mobile or when prompt is ready
  const shouldShowFloatingWidget =
    !isInstalled && !dismissed && (isMobile || deferredPrompt !== null);

  const isInstallable = !isInstalled;

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isMobile,
        promptInstall,
        openGuide,
      }}
    >
      {children}

      {/* Floating install widget / banner */}
      {shouldShowFloatingWidget && (
        <aside
          role="complementary"
          aria-label="Install app"
          className={`fixed z-50 transition-all duration-300 ${
            hasBottomNav
              ? "bottom-20 left-3 right-3 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm"
              : "bottom-4 left-3 right-3 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm"
          }`}
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Image
                  src="/icons/icon-192.png"
                  alt="App icon"
                  width={40}
                  height={40}
                  className="size-full object-cover"
                  onError={(e) => {
                    // Fallback to icon
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <Download className="size-5 absolute" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-xs sm:text-sm font-bold leading-tight text-foreground truncate">
                  Install Cousin Family
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight truncate">
                  Full-screen &amp; quick access on your phone
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                onClick={() => void promptInstall()}
                className="h-8 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs hover:brightness-110 active:scale-95"
              >
                Install
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDismiss}
                className="size-8 rounded-full text-muted-foreground hover:bg-muted"
                aria-label="Dismiss banner for 24 hours"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Interactive Install Guide Dialog (for iOS, or when native prompt is unavailable) */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6 sm:max-w-md">
          <DialogHeader className="text-left">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Smartphone className="size-6" />
            </div>
            <DialogTitle className="font-display text-center text-lg font-bold">
              Install Our Cousin Family
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Add this app to your phone&apos;s home screen for the best experience.
            </DialogDescription>
          </DialogHeader>

          {/* OS Switcher Tabs */}
          <div className="mt-3 flex rounded-xl bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("android")}
              className={`flex-1 rounded-lg py-1.5 font-medium transition ${
                activeTab === "android"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Android / Chrome
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ios")}
              className={`flex-1 rounded-lg py-1.5 font-medium transition ${
                activeTab === "ios"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              iPhone / Safari
            </button>
          </div>

          {/* Steps */}
          {activeTab === "android" ? (
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  1
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    Tap the Menu button
                  </p>
                  <p className="text-muted-foreground">
                    Tap the three dots (
                    <MoreVertical className="inline size-3.5 text-foreground" />
                    ) in the top-right corner of Chrome.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  2
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    Tap &quot;Install app&quot; or &quot;Add to Home screen&quot;
                  </p>
                  <p className="text-muted-foreground">
                    Look for the Install option in the Chrome dropdown menu.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  3
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    Confirm &amp; launch
                  </p>
                  <p className="text-muted-foreground">
                    Tap &quot;Install&quot;. The app will appear on your home
                    screen like a native app.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  1
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    Tap the Share button
                  </p>
                  <p className="text-muted-foreground">
                    Tap the Share icon (
                    <Share className="inline size-3.5 text-foreground" />
                    ) in the Safari toolbar at the bottom of your screen.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  2
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    Select &quot;Add to Home Screen&quot;
                  </p>
                  <p className="text-muted-foreground">
                    Scroll down and tap{" "}
                    <PlusSquare className="inline size-3.5 text-foreground" />{" "}
                    <strong>Add to Home Screen</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  3
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    Tap &quot;Add&quot;
                  </p>
                  <p className="text-muted-foreground">
                    Tap <strong>Add</strong> at the top right. Cousin Family will
                    be installed on your iPhone home screen!
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5">
            <Button
              className="w-full rounded-full font-semibold"
              onClick={() => setGuideOpen(false)}
            >
              <Check className="mr-2 size-4" /> Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PwaContext.Provider>
  );
}

/** Embeddable install app button for hero sections, headers, and toolbars */
export function InstallAppButton({
  className = "",
  variant = "default",
  size = "default",
}: {
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const { isInstalled, promptInstall } = usePwaInstall();

  if (isInstalled) return null;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => void promptInstall()}
      className={`gap-2 rounded-full font-semibold transition active:scale-95 ${className}`}
    >
      <Download className="size-4 shrink-0" />
      <span>Install App</span>
    </Button>
  );
}

/** Standalone card widget for landing page or dashboard */
export function InstallAppCard({ className = "" }: { className?: string }) {
  const { isInstalled, promptInstall } = usePwaInstall();

  if (isInstalled) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6 shadow-sm ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Smartphone className="size-6" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Install Our Cousin Family on your phone
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed max-w-md">
              Enjoy fullscreen view, fast offline browsing, and quick 1-tap access right from your phone&apos;s home screen.
            </p>
          </div>
        </div>

        <Button
          onClick={() => void promptInstall()}
          className="h-11 shrink-0 rounded-full px-6 font-semibold shadow-sm hover:brightness-110 active:scale-95"
        >
          <Download className="mr-2 size-4" /> Install App
        </Button>
      </div>
    </div>
  );
}
