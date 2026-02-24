"use client";

import React from "react";
import { useState, useTransition } from "react";
import { MessageSquare, Send, Trash2, Loader2 } from "lucide-react";
import { addPhaseComment, deletePhaseComment } from "@/actions/comments";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Comment {
  id: string;
  content: string;
  createdAt: Date;
  user: User;
}

interface CommentSectionProps {
  phaseId: string;
  comments: Comment[];
  currentUserId: string;
  isAdmin?: boolean;
}

export function CommentSection({
  phaseId,
  comments,
  currentUserId,
  isAdmin = false,
}: CommentSectionProps) {
  const t = useTranslations("comments");
  const [newComment, setNewComment] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localComments, setLocalComments] = useState<Comment[]>(comments);

  const handleAddComment = async (): Promise<void> => {
    if (!newComment.trim()) return;
    const commentText: string = newComment.trim();
    setNewComment("");
    startTransition(async () => {
      try {
        const result: Comment = await addPhaseComment({ phaseId, content: commentText });
        setLocalComments((prev: Comment[]) => [result, ...prev]);
      } catch (error: unknown) {
        console.error("Failed to add comment:", error);
        setNewComment(commentText);
      }
    });
  };

  const handleDeleteComment = (commentId: string): void => {
    setDeletingId(commentId);
    startTransition(async () => {
      try {
        await deletePhaseComment(commentId);
        setLocalComments((prev: Comment[]) => prev.filter((c) => c.id !== commentId));
      } catch (error: unknown) {
        console.error("Failed to delete comment:", error);
      } finally {
        setDeletingId(null);
      }
    });
  };

  const getAvatarLetter = (user: User): string =>
    user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();

  const getUserDisplayName = (user: User): string => user.name || user.email;
  const canDelete = (commentUserId: string): boolean =>
    commentUserId === currentUserId || isAdmin;

  const sortedComments: Comment[] = [...localComments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-gray-600" />
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          {t("title")}
          {localComments.length > 0 && (
            <span className="ml-2 text-gray-500 normal-case font-normal">
              {localComments.length}
            </span>
          )}
        </h2>
      </div>

      {localComments.length === 0 ? (
        <div className="text-center py-6">
          <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{t("noCommentsYet")}</p>
        </div>
      ) : (
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {sortedComments.map((comment: Comment) => (
            <div key={comment.id} className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 group">
              <div className="flex-shrink-0">
                {comment.user.image ? (
                  <img src={comment.user.image} alt={getUserDisplayName(comment.user)} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white text-xs font-semibold flex items-center justify-center">
                    {getAvatarLetter(comment.user)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium text-gray-900">{getUserDisplayName(comment.user)}</p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <p className="text-sm text-gray-700 mt-1 break-words">{comment.content}</p>
              </div>
              {canDelete(comment.user.id) && (
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  disabled={deletingId === comment.id || isPending}
                  className="text-gray-300 sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0 hover:text-red-500 p-1 disabled:opacity-50 transition-all"
                  title={t("deleteComment")}
                >
                  {deletingId === comment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 pt-3 border-t border-gray-100">
        <input
          type="text"
          placeholder={t("addComment")}
          value={newComment}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewComment(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && !e.shiftKey && !isPending) { e.preventDefault(); handleAddComment(); }
          }}
          disabled={isPending}
          className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none disabled:bg-gray-50"
        />
        <button
          onClick={handleAddComment}
          disabled={isPending || !newComment.trim()}
          className="p-2 text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
          title={t("sendComment")}
        >
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
