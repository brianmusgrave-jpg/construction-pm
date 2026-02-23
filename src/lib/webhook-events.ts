export const WEBHOOK_EVENTS = [
  "project.created",
  "project.updated",
  "phase.status_changed",
  "inspection.scheduled",
  "inspection.result",
  "change_order.submitted",
  "change_order.approved",
  "change_order.rejected",
  "daily_log.created",
  "document.uploaded",
  "photo.uploaded",
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];
