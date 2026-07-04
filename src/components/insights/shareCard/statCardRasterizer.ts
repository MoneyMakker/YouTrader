import type { StatTextLayer } from "./statCardSvgBuilder";
import type { AchievementSvgTextLayer } from "./achievementShareSvgBuilder";

export type StatCardRasterJob = {
  templateUri: string;
  layers?: StatTextLayer[];
  achievementLayers?: AchievementSvgTextLayer[];
  width: number;
  height: number;
  filename: string;
  resolve: (uri: string) => void;
  reject: (error: Error) => void;
};

type HostListener = (job: StatCardRasterJob) => void;

let hostListener: HostListener | null = null;

export function registerStatCardExportHost(listener: HostListener) {
  hostListener = listener;
  return () => {
    if (hostListener === listener) hostListener = null;
  };
}

export function enqueueStatCardRaster(job: Omit<StatCardRasterJob, "resolve" | "reject">) {
  return new Promise<string>((resolve, reject) => {
    if (!hostListener) {
      reject(new Error("Stat card export host is not mounted"));
      return;
    }
    hostListener({
      ...job,
      resolve,
      reject,
    });
  });
}
