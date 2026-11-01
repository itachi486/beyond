import { adminEnglish } from "./messages.en";
// Separate administrator catalog: never changes the public locale or user-authored data.
export const adminLocale = "en";
export const adminMessages = {
  ...adminEnglish,
  pendingDeletion: "Pending File Cleanup",
  pendingExplanation:
    "The central metadata was removed, but file cleanup did not finish. Confirm deletion again to retry safely. No successful completion has been reported.",
  openSettings: "Open system settings",
  dashboard: "Dashboard",
  users: "Users",
  characters: "Characters",
  worlds: "Worlds",
  content: "Content",
  settings: "System Settings",
  activity: "Activity Log",
  totalUsers: "Total Users",
  registeredCharacters: "Registered Characters",
  totalWorlds: "Total Worlds",
  storage: "Storage Usage",
  scopeUsers: "Registered member accounts",
  scopeCharacters: "Central originals only",
  scopeWorlds: "Server editorial worlds",
  unavailable: "Unavailable",
  greeting: "Your universe, at a glance",
  intro: "Monitor and manage your BEYOND universe.",
  sevenDays: "Last 7 Days Activity",
  statistics: "Key Statistics",
  system: "System Status",
  recentCharacters: "Recently Registered Characters",
  recentWorlds: "Recently Created Worlds",
  reports: "Reports & Inquiries",
  logs: "Latest System Logs",
  quick: "Quick Actions",
  viewAll: "View all",
  name: "Name",
  type: "Type",
  created: "Created",
  status: "Status",
  owner: "Owner",
  notRecorded: "Not recorded",
  emptyCharacters: "No central characters registered yet.",
  emptyEvents: "No recorded activity yet.",
  noReports: "Reports and inquiries are not collected by this server.",
  noStorage: "Storage metering and quota are not configured.",
  noBackup: "No centrally recorded backup.",
  connectionCount: "Editorial connections",
  visitorCount: "Public visitor analytics",
  personalData: "Personal browser worlds",
  notCentral: "Not centrally stored",
  database: "Database",
  api: "API service",
  healthy: "Connected",
  backup: "Last Backup",
  recorded: "Recorded events",
  loading: "Loading dashboard…",
  upload: "Upload Character",
  manageWorlds: "Manage worlds",
  manageContent: "Manage content",
  reviewLogs: "Review activity logs",
  about: "BEYOND Admin",
  aboutText:
    "A thoughtful workspace for the worlds, characters and connections you create.",
  footer: "All rights reserved.",
  delete: "Permanently Delete",
  deleteConfirm: "Delete Permanently",
  cancel: "Cancel",
  deleting: "Deleting…",
  closeDelete: "Close deletion confirmation",
  deleteTitle: "Permanent deletion",
  deleteWarning:
    "This cannot be undone from this interface. Internal audit records and existing backups are retained.",
  worldWarning:
    "Deletes this server world, its discoveries and connections touching those discoveries. Central characters, other worlds, accounts and browser-local data are preserved. External media files are not owned by this world and are not deleted.",
  characterWarning:
    "Deletes the central record and its dedicated original and preview files. Shared files are retained. Existing browser-local copies and placements are not deleted; browser usage cannot be enumerated by this server.",
  deleted: "Permanent deletion completed.",
  deleteFailed:
    "Deletion failed. Refresh or retry; no completion has been confirmed.",
  menu: "Toggle administrator navigation",
  private: "Private administration",
  welcome: "BEYOND Admin",
} as const;
export type AdminMessageKey = keyof typeof adminMessages;
export const t = (key: AdminMessageKey) => adminMessages[key];
export const adminNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);
export const adminDate = (value: string | Date, short = false) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? t("unavailable")
    : new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        ...(!short
          ? ({ year: "numeric", hour: "2-digit", minute: "2-digit" } as const)
          : {}),
      }).format(date) + (!short ? " UTC" : "");
};
