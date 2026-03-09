/**
 * @file src/actions/feedback.ts
 * @description Server action for submitting in-app feedback.
 */
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const dbc = db as any;

export async function submitFeedback(
  category: string,
  message: string,
  rating?: number
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!message.trim() || message.length < 10) {
    return { success: false, error: "Please provide a more detailed message (10+ characters)" };
  }

  if (message.length > 2000) {
    return { success: false, error: "Message too long (max 2000 characters)" };
  }

  const validCategories = ["general", "bug", "feature", "other"];
  if (!validCategories.includes(category)) {
    return { success: false, error: "Invalid category" };
  }

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return { success: false, error: "Rating must be 1-5" };
  }

  try {
    await dbc.feedback.create({
      data: {
        userId: session.user.id,
        category,
        message: message.trim(),
        rating: rating || null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[feedback] Submit error:", error);
    return { success: false, error: "Failed to submit feedback" };
  }
}
