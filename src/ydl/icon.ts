/**
 * YouTrader Design Language — icon rules.
 * Prefer semantic `YdlSymbol` names (src/ydl/symbols). Lucide remains elsewhere until migrated.
 */

export const ydlIconRules = {
  preferredLibraryFuture: "SF Symbols",
  currentLibrary: "lucide-react-native",
  defaultSize: 20,
  sizes: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 28,
  },
} as const;

/**
 * Lucide → SF Symbol name map for icons already used in the app (inventory 3A).
 * Use when migrating icon call sites in later phases.
 */
export const ydlLucideToSfSymbol: Record<string, string> = {
  BadgeCheck: "checkmark.seal.fill",
  BookOpen: "book.fill",
  BrainCircuit: "brain.head.profile",
  Building2: "building.2.fill",
  Calculator: "function",
  CalendarDays: "calendar",
  Camera: "camera.fill",
  ChartColumnIncreasing: "chart.bar.fill",
  Check: "checkmark",
  ChevronDown: "chevron.down",
  ChevronLeft: "chevron.left",
  ChevronRight: "chevron.right",
  CircleUserRound: "person.crop.circle",
  Cloud: "cloud.fill",
  FileText: "doc.text.fill",
  ImagePlus: "photo.badge.plus",
  Lock: "lock.fill",
  LogOut: "rectangle.portrait.and.arrow.right",
  Mail: "envelope.fill",
  Mic: "mic.fill",
  Newspaper: "newspaper.fill",
  RefreshCw: "arrow.clockwise",
  Settings: "gearshape.fill",
  Share2: "square.and.arrow.up",
  ShieldCheck: "checkmark.shield.fill",
  Sparkles: "sparkles",
  Target: "target",
  Trash2: "trash.fill",
  TrendingUp: "chart.line.uptrend.xyaxis",
  Trophy: "trophy.fill",
  Unlock: "lock.open.fill",
  X: "xmark",
  Zap: "bolt.fill",
};
