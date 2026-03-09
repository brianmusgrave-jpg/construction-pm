/**
 * @file src/components/ui/FeedbackWidget.tsx
 * @description Floating feedback button + modal for submitting in-app feedback.
 * Positioned in bottom-left to avoid collision with KeeneyFAB (bottom-right).
 */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquarePlus, X, Send, Star } from "lucide-react";
import { submitFeedback } from "@/actions/feedback";
import { toast } from "sonner";

export function FeedbackWidget() {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const result = await submitFeedback(category, message, rating || undefined);
    setSending(false);

    if (result.success) {
      toast.success(t("thankYou"));
      setMessage("");
      setRating(0);
      setCategory("general");
      setOpen(false);
    } else {
      toast.error(result.error || t("submitFailed"));
    }
  }

  return (
    <>
      {/* Floating trigger button — bottom-left */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-full shadow-lg hover:bg-gray-700 transition-colors max-lg:bottom-20 max-lg:left-4"
        aria-label={t("triggerLabel")}
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span className="hidden sm:inline">{t("triggerLabel")}</span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">{t("modalTitle")}</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("categoryLabel")}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm"
                >
                  <option value="general">{t("catGeneral")}</option>
                  <option value="bug">{t("catBug")}</option>
                  <option value="feature">{t("catFeature")}</option>
                  <option value="other">{t("catOther")}</option>
                </select>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("messageLabel")}</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("messagePlaceholder")}
                  rows={4}
                  maxLength={2000}
                  className="w-full p-2 border rounded-lg text-sm resize-none"
                  required
                />
                <p className="text-xs text-gray-400 text-right">{message.length}/2000</p>
              </div>

              {/* Star rating */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("ratingLabel")}</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-0.5"
                    >
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          n <= (hoverRating || rating)
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={sending || message.trim().length < 10}
                className="w-full flex items-center justify-center gap-2 p-2.5 bg-gray-900 text-white rounded-lg font-medium text-sm disabled:opacity-40 transition-opacity"
              >
                <Send className="w-4 h-4" />
                {sending ? t("sending") : t("submitButton")}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
