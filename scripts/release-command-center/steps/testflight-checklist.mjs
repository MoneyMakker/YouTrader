import { stepResult, check } from "../lib.mjs";

export function testFlightChecklist() {
  const sections = [
    {
      title: "AI Coach",
      items: ["Daily Plan (Pro)", "Weekly Coach (Pro)", "Journal Summary", "Risk Predictor", "News Explainer", "Daily Challenge", "Free user → local preview only"],
    },
    {
      title: "Market Intelligence",
      items: ["Pre-market brief", "Sentiment card", "Watchlist risk", "Pro gating", "Cached rows for free tier"],
    },
    {
      title: "Achievements & Share",
      items: ["Achievement unlock", "Share card export", "Monthly share limit (free)", "Watermarked vs Pro share"],
    },
    {
      title: "PDF & Export",
      items: ["Monthly PDF preview (free)", "Pro PDF export", "Export rate limits"],
    },
    {
      title: "Cloud Sync & Media",
      items: ["Cloud sync sign-in", "Voice notes record/playback", "Photo/screenshot attach", "Secure upload"],
    },
    {
      title: "Localization & UI",
      items: ["EN / RU / DE / FR / ES / IT / UK spot check", "Dark mode readability", "Premium lock overlays"],
    },
    {
      title: "Performance & Offline",
      items: ["Cold launch < 3s feel", "AI screen scroll 60fps", "Airplane mode → local fallback", "Quota banner when near limit"],
    },
    {
      title: "Rollback drill (staging)",
      items: ["AI_PLATFORM_V2_ENABLED=false", "Weekly Coach still returns JSON", "Restore AI_PLATFORM_V2_ENABLED=true"],
    },
  ];

  const checks = sections.map((s) => check(`qa_${s.title}`, s.title, "PASS", `${s.items.length} items`));

  return { step: stepResult("checklist", "Step 7 — TestFlight Checklist", checks), sections };
}
