/**
 * @file webhook-events.ts
 * @description Canonical list of webhook event types supported by Construction PM.
 *
 * When a significant event occurs in the app (e.g. a change order is approved),
 * the relevant server action dispatches a webhook payload to all active webhook
 * endpoints registered by the user — see `src/actions/webhooks.ts`.
 *
 * Adding a new event:
 *   1. Add the event string to WEBHOOK_EVENTS below.
 *   2. Update the webhook settings UI (event checkboxes) in the locales.
 *   3. Call `triggerWebhooks(event, payload)` from the relevant server action.
 */

/** All webhook event types that can be subscribed to via the webhooks settings. */
export const WEBHOOK_EVENTS = [
  "project.created",          // New project was created
  "project.updated",          // Project metadata was updated
  "phase.status_changed",     // A phase moved to a new status
  "inspection.scheduled",     // An inspection was scheduled on a phase
  "inspection.result",        // An inspection result (PASS/FAIL/CONDITIONAL) was recorded
  "change_order.submitted",   // A change order was submitted for review
  "change_order.approved",    // A change order was approved
  "change_order.rejected",    // A change order was rejected
  "daily_log.created",        // A daily log entry was created
  "document.uploaded",        // A document was uploaded to a phase
  "photo.uploaded",           // A photo was uploaded to a phase
] as const;

/** Union type of all valid webhook event strings. */
export type WebhookEvent = typeof WEBHOOK_EVENTS[number];
