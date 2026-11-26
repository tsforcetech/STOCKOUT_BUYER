import { http } from "@/lib/api/client";
import { unwrapData, type Envelope } from "@/lib/api/envelope";
import type { MarkAllReadResultDto, MarkReadResultDto, UnreadCountDto, UserNotificationPageDto } from "@/api/types/notifications";

const BASE = "/api/v1/notifications";

/**
 * The signed-in user's notifications. The user comes only from the token: no recipient id is ever sent. Without
 * organizationId the server returns the user's personal and organization notifications together.
 * Push device enrollment (/devices) is not used: Firebase push isn't enabled (Firebase:Enabled=false).
 */
export const notificationsService = {
  list: async (q: { unreadOnly: boolean; page: number; pageSize: number }, signal?: AbortSignal) =>
    unwrapData<UserNotificationPageDto>(
      await http.get<Envelope<UserNotificationPageDto>>(`${BASE}?unreadOnly=${q.unreadOnly}&page=${q.page}&pageSize=${q.pageSize}`, { signal }),
    ),
  unreadCount: async (signal?: AbortSignal) => unwrapData<UnreadCountDto>(await http.get<Envelope<UnreadCountDto>>(`${BASE}/unread-count`, { signal })),
  markRead: async (notificationId: string) =>
    unwrapData<MarkReadResultDto>(await http.post<Envelope<MarkReadResultDto>>(`${BASE}/${encodeURIComponent(notificationId)}/read`)),
  markAllRead: async () => unwrapData<MarkAllReadResultDto>(await http.post<Envelope<MarkAllReadResultDto>>(`${BASE}/read-all`)),
  /** Web push: enroll (or refresh) this browser's FCM token. The token is never logged or shown. */
  registerDevice: async (body: { platform: "WEB"; installationId: string; fcmToken: string; organizationId?: string | null }) =>
    unwrapData<{ deviceId: string; alreadyRegistered: boolean }>(await http.post<Envelope<{ deviceId: string; alreadyRegistered: boolean }>>(`${BASE}/devices`, body)),
  /** Logout / account switch: revoke this browser installation's registrations (idempotent). */
  revokeInstallation: async (installationId: string) =>
    unwrapData<{ revokedCount: number }>(await http.delete<Envelope<{ revokedCount: number }>>(`${BASE}/devices/installations/${encodeURIComponent(installationId)}`)),
};

export const notificationKeys = {
  all: ["notifications"] as const,
  unread: ["notifications", "unread-count"] as const,
  list: (unreadOnly: boolean, page: number) => ["notifications", "list", unreadOnly, page] as const,
};
