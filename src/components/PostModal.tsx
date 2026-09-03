"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, Heart, MessageCircle, Send, Loader2, MoreVertical, User, AtSign } from "lucide-react";
import { Post, PostComment } from "@/types";
import { createClient } from "@/utils/supabase/client";
import { renderTextWithMentions, formatRelativeTime, formatNumber } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

interface PostModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onLikeToggle: (postId: string) => Promise<void>;
  onAddComment: (postId: string, text: string) => Promise<void>;
}

export function PostModal({
  post,
  isOpen,
  onClose,
  onLikeToggle,
  onAddComment,
}: PostModalProps) {
  const { t } = useLanguage();
  const supabase = createClient();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [user, setUser] = useState<{ id: string; username: string; avatar_url?: string; full_name?: string } | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [requireAuth, setRequireAuth] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && post) {
      setLiked(post.user_has_liked || false);
      setLikeCount(post.like_count || 0);
      setCommentCount(post.comment_count || 0);
      fetchComments(post.id);
      fetchCurrentUser();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      setComments([]);
      setNewComment("");
      setUser(null);
      setLoadingUser(true);
      setRequireAuth(false);
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, post?.id]);

  const fetchCurrentUser = async () => {
    setLoadingUser(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, avatar_url")
        .eq("id", authUser.id)
        .single();
      if (profile) {
        setUser({
          id: profile.id,
          username: profile.nickname || profile.full_name || "Kullanıcı",
          avatar_url: profile.avatar_url,
          full_name: profile.full_name,
        });
      } else {
        const metadata = authUser.user_metadata;
        setUser({
          id: authUser.id,
          username: (metadata?.nickname as string) || (metadata?.full_name as string) || "Kullanıcı",
        });
      }
      setRequireAuth(false);
    } else {
      setUser(null);
      setRequireAuth(true);
    }
    setLoadingUser(false);
  };

  const fetchComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setComments(data);
        setCommentCount(data.length);
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [comments.length, scrollToBottom]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  const handleLikeClick = async () => {
    if (!post) return;
    const wasLiked = liked;
    const newLikeCount = wasLiked ? likeCount - 1 : likeCount + 1;

    setLiked(!wasLiked);
    setLikeCount(newLikeCount);

    try {
      await onLikeToggle(post.id);
    } catch (err) {
      setLiked(wasLiked);
      setLikeCount(likeCount);
      console.error("Failed to toggle like:", err);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post || !newComment.trim() || submittingComment || requireAuth || loadingUser || !user) return;

    const text = newComment.trim();
    setSubmittingComment(true);
    setNewComment("");

    const optimisticComment: PostComment = {
      id: `temp-${Date.now()}`,
      post_id: post.id,
      user_id: user.id,
      username: user.username,
      text,
      created_at: new Date().toISOString(),
      avatar_url: user.avatar_url || null,
    };

    setComments((prev) => [...prev, optimisticComment]);
    setCommentCount((c) => c + 1);
    scrollToBottom();

    try {
      await onAddComment(post.id, text);
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
      setCommentCount((c) => c - 1);
      setNewComment(text);
      console.error("Failed to add comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  if (!isOpen || !post) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Gönderi detayı"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-backdrop-in"
        onClick={handleBackdropClick}
      />
      <div className="relative w-full max-w-4xl h-[90vh] md:h-[90vh] bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden animate-modal-in">
        <div className="flex h-full flex-col md:flex-row">
          <div className="relative flex-1 bg-gray-950 dark:bg-slate-950 min-h-0 md:max-w-[60%] flex items-center justify-center p-3 md:p-5">
            <img
              src={post.image_url}
              alt={post.description || "Gönderi görseli"}
              className="max-h-full max-w-full rounded-xl md:rounded-2xl object-contain"
              loading="eager"
            />
          </div>

          <div className="flex-1 flex flex-col w-full md:w-[380px] md:max-w-[380px] border-l border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-800">
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 overflow-hidden">
                {post.tenant?.profile_image_url ? (
                  <img
                    src={post.tenant.profile_image_url}
                    alt={post.tenant.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center leading-none">
                <p className="font-semibold text-gray-900 dark:text-white truncate text-sm leading-snug">{post.tenant?.name || "İşletme"}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate leading-tight mt-0.5">{formatRelativeTime(post.created_at)}</p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-full p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white transition-colors"
                aria-label={t("modal.close") || "Kapat"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {post.description && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{renderTextWithMentions(post.description)}</p>
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-gray-500" />
                  <span>{t("posts.comments") || "Yorumlar"}</span>
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({formatNumber(commentCount)})</span>
                </h3>

                {loadingComments ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3 animate-pulse">
                        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-700 rounded" />
                          <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>{t("posts.no_comments") || "Henüz yorum yok. İlk yorumu siz yapın!"}</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    {comments.map((comment) => (
                      <CommentItem key={comment.id} comment={comment} currentUserId={user?.id} />
                    ))}
                    <div ref={commentsEndRef} />
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-800 px-4 py-3 space-y-2">
              {requireAuth || loadingUser ? (
                <div className="flex items-center gap-2 text-center py-3 text-sm text-gray-500 dark:text-gray-400">
                  <span>{t("posts.login_to_comment") || "Giriş yaparak yorum yapın"}</span>
                </div>
              ) : (
                <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  )}
                  <div className="flex-1 flex items-center gap-2 min-h-9">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={t("posts.add_comment") || "Yorum ekle..."}
                      className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 text-sm leading-none py-0 px-0 focus:outline-none"
                      maxLength={500}
                      disabled={submittingComment}
                      aria-label={t("posts.add_comment") || "Yorum ekle"}
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim() || submittingComment || requireAuth || loadingUser}
                      className="shrink-0 p-1.5 rounded-full text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={t("posts.send") || "Gönder"}
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </form>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-5">
                  <button
                    onClick={handleLikeClick}
                    className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition-colors"
                    aria-label={liked ? (t("posts.unlike") || "Beğeniyi geri al") : (t("posts.like") || "Beğen")}
                    aria-pressed={liked}
                  >
                    <Heart className={`h-5 w-5 ${liked ? "fill-current text-red-500" : "stroke-current"}`} />
                    <span className="text-sm font-medium leading-none">{formatNumber(likeCount)}</span>
                  </button>
                  <button className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" aria-label={t("posts.comment") || "Yorum yap"}>
                    <MessageCircle className="h-5 w-5 stroke-current" />
                    <span className="text-sm font-medium leading-none">{formatNumber(commentCount)}</span>
                  </button>
                </div>
                <button className="flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" aria-label={t("posts.more") || "Daha fazla"}>
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: PostComment;
  currentUserId: string | undefined;
}

function CommentItem({ comment, currentUserId }: CommentItemProps) {
  const isOwn = comment.user_id === currentUserId;

  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {comment.avatar_url ? (
        <img
          src={comment.avatar_url}
          alt={comment.username}
          className="h-8 w-8 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-white text-sm">{comment.username}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(comment.created_at)}</span>
          {isOwn && (
            <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full">
              {t("posts.you") || "Sen"}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
          {renderTextWithMentions(comment.text)}
        </p>
      </div>
    </div>
  );
}

function t(key: string): string {
  const dict: Record<string, string> = {
    "modal.close": "Kapat",
    "posts.comments": "Yorumlar",
    "posts.no_comments": "Henüz yorum yok. İlk yorumu siz yapın!",
    "posts.add_comment": "Yorum ekle...",
    "posts.send": "Gönder",
    "posts.like": "Beğen",
    "posts.unlike": "Beğeniyi geri al",
    "posts.comment": "Yorum yap",
    "posts.more": "Daha fazla",
    "posts.you": "Sen",
    "posts.login_to_comment": "Giriş yaparak yorum yapın",
  };
  return dict[key] || key;
}