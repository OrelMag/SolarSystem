import type { LaunchMissionStatus } from "./launchMission";

export function launchStatusLabel(status: LaunchMissionStatus): string {
  if (status === "en-route") return "EN ROUTE";
  return status.toUpperCase();
}
