"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const idleTimeoutMs = 30 * 60 * 1000;
const warningThresholdMs = idleTimeoutMs - 2 * 60 * 1000;
const heartbeatIntervalMs = 60 * 1000;
const activityChannelName = "northstar-session-activity";

export function SessionManager() {
  const router = useRouter();
  const [warningVisible, setWarningVisible] = useState(false);
  const endingSession = useRef(false);
  const recordActivityRef = useRef<() => void>(() => {});

  useEffect(() => {
    const supabase = createClient();
    const lastActivity = { current: Date.now() };
    const lastHeartbeat = { current: Date.now() };
    const lastBroadcast = { current: 0 };
    let heartbeatInFlight = false;
    let channel: BroadcastChannel | undefined;

    async function expireSession() {
      if (endingSession.current) return;
      endingSession.current = true;
      setWarningVisible(false);

      try {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) {
          console.error("Unable to clear the expired browser session.", error.message);
        }
      } catch (error) {
        console.error("Unable to clear the expired browser session.", error);
      } finally {
        router.replace("/login?error=session-expired");
        router.refresh();
      }
    }

    async function sendHeartbeat() {
      const now = Date.now();
      if (
        heartbeatInFlight ||
        now - lastHeartbeat.current < heartbeatIntervalMs
      ) {
        return;
      }

      heartbeatInFlight = true;
      lastHeartbeat.current = now;

      try {
        const response = await fetch("/api/session/activity", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (response.status === 401) {
          await expireSession();
        } else if (!response.ok) {
          console.error("Unable to refresh the application session.", response.status);
        }
      } catch (error) {
        console.error("Unable to contact the application session endpoint.", error);
      } finally {
        heartbeatInFlight = false;
      }
    }

    function recordActivity(shouldBroadcast = true) {
      const now = Date.now();
      lastActivity.current = now;
      setWarningVisible(false);

      if (
        shouldBroadcast &&
        channel &&
        now - lastBroadcast.current >= 1000
      ) {
        lastBroadcast.current = now;
        channel.postMessage({ type: "activity", at: now });
      }

      void sendHeartbeat();
    }

    recordActivityRef.current = () => recordActivity();

    function handleRemoteActivity(event: MessageEvent<{ type?: string; at?: number }>) {
      const activityAt = event.data?.at;
      if (
        event.data?.type === "activity" &&
        typeof activityAt === "number" &&
        Number.isFinite(activityAt) &&
        activityAt <= Date.now() + 5000 &&
        activityAt > lastActivity.current
      ) {
        recordActivity(false);
      }
    }

    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(activityChannelName);
      channel.addEventListener("message", handleRemoteActivity);
    }

    const activityEvents = [
      "pointerdown",
      "pointermove",
      "keydown",
      "click",
      "touchstart",
      "scroll",
    ] as const;
    const activityHandler = () => recordActivity();
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, activityHandler, { passive: true });
    });

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") recordActivity();
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    const historyHandler = () => router.refresh();
    const pageShowHandler = (event: PageTransitionEvent) => {
      if (event.persisted) router.refresh();
    };
    window.addEventListener("popstate", historyHandler);
    window.addEventListener("pageshow", pageShowHandler);

    const timer = window.setInterval(() => {
      const idleFor = Date.now() - lastActivity.current;
      if (idleFor >= idleTimeoutMs) {
        void expireSession();
      } else {
        setWarningVisible(idleFor >= warningThresholdMs);
        if (idleFor < heartbeatIntervalMs) void sendHeartbeat();
      }
    }, 5000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !endingSession.current) {
        router.replace("/login?message=signed-out");
        router.refresh();
      }
    });

    return () => {
      window.clearInterval(timer);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, activityHandler);
      });
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.removeEventListener("popstate", historyHandler);
      window.removeEventListener("pageshow", pageShowHandler);
      channel?.removeEventListener("message", handleRemoteActivity);
      channel?.close();
      subscription.unsubscribe();
      recordActivityRef.current = () => {};
    };
  }, [router]);

  if (!warningVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-5"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
      aria-describedby="session-warning-description"
    >
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="session-warning-title" className="text-lg font-bold text-slate-900">
          Your session is about to expire
        </h2>
        <p id="session-warning-description" className="mt-2 text-sm leading-6 text-slate-600">
          You will be signed out in two minutes because of inactivity. Continue working to stay
          signed in.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => recordActivityRef.current()}
            className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Stay signed in
          </button>
        </div>
      </section>
    </div>
  );
}
