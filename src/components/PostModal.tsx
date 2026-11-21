"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  X,
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
  User,
} from "lucide-react";
import { Post, PostComment } from "@/types";
import { createClient } from "@/utils/supabase/client";
import {
  renderTextWithMentions,
  formatRelativeTime,
  formatNumber,
} from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

interface PostModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onLikeToggle: (
    postId: string,
  ) => Promise<{ liked?: boolean; likeCount?: number } | void>;
  onAddComment: (
    postId: string,
    text: string,
  ) => Promise<{ comment?: PostComment; commentCount?: number } | void>;
  posts?: Post[];
  onNavigate?: (postId: string) => void;
}

export function PostModal({
  post,
  isOpen,
  onClose,
  onLikeToggle,
  onAddComment,
  posts,
  onNavigate,
}: PostModalProps) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const supabase = createClient();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [user, setUser] = useState<{
    id: string;
    username: string;
    avatar_url?: string;
    full_name?: string;
  } | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [requireAuth, setRequireAuth] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const currentPostIndex = posts?.findIndex((item) => item.id === post?.id) ?? -1;
  const previousPost =
    currentPostIndex > 0 ? posts?.[currentPostIndex - 1] : undefined;
  const nextPost =
    currentPostIndex >= 0 && currentPostIndex < (posts?.length ?? 0) - 1
      ? posts?.[currentPostIndex + 1]
      : undefined;

  const fetchCurrentUser = async () => {
    setLoadingUser(true);
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
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
          username:
            (metadata?.nickname as string) ||
            (metadata?.full_name as string) ||
            "Kullanıcı",
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
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- modal açılış/kapanışında durum sıfırlanır */
    if (isOpen && post) {
      setLiked(post.user_has_liked || false);
      setLikeCount(post.like_count || 0);
      setComments([]);
      fetchComments(post.id);
      fetchCurrentUser();
      document.body.style.overflow = "hidden";
    } else {
      // "unset" body'nin overflow'unu visible yapıp globals.css'teki
      // overflow:hidden kilidini bozuyordu (sayfa kayabilir hale geliyordu).
      document.body.style.overflow = "";
      setComments([]);
      setNewComment("");
      setUser(null);
      setLoadingUser(true);
      setRequireAuth(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => {
      document.body.style.overflow = "";
    };
  }, [
    isOpen,
    post?.id,
    post?.user_has_liked,
    post?.like_count,
    post?.comment_count,
  ]);

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
    } else if (e.key === "ArrowLeft" && previousPost && onNavigate) {
      e.preventDefault();
      onNavigate(previousPost.id);
    } else if (e.key === "ArrowRight" && nextPost && onNavigate) {
      e.preventDefault();
      onNavigate(nextPost.id);
    }
  };

  const handleLikeClick = async () => {
    if (!post) return;
    if (requireAuth || (!user && !loadingUser)) {
      router.push("/login");
      return;
    }

    const wasLiked = liked;
    const newLikeCount = wasLiked ? Math.max(0, likeCount - 1) : likeCount + 1;

    setLiked(!wasLiked);
    setLikeCount(newLikeCount);

    try {
      const res = await onLikeToggle(post.id);
      if (res && typeof res.liked === "boolean") {
        setLiked(res.liked);
      }
      if (res && typeof res.likeCount === "number") {
        setLikeCount(res.likeCount);
      }
    } catch (err) {
      setLiked(wasLiked);
      setLikeCount(likeCount);
      console.error("Failed to toggle like:", err);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !post ||
      !newComment.trim() ||
      submittingComment ||
      requireAuth ||
      loadingUser ||
      !user
    )
      return;

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
    scrollToBottom();

    try {
      await onAddComment(post.id, text);
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
      setNewComment(text);
      console.error("Failed to add comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: post.tenant?.name || "İşletme paylaşımı",
          text: post.description || "",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      // Kullanıcı paylaşım penceresini kapatmış olabilir.
    }
  };

  if (!isOpen || !post) return null;

  return createPortal(
    <div
      ref={modalRef}
      data-no-swipe
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Gönderi detayı"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-[#08090b]/90 backdrop-blur-[2px] animate-backdrop-in"
        onClick={handleBackdropClick}
      />
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#1c1d20] text-white shadow-2xl animate-modal-in md:h-[min(92vh,960px)] md:w-[min(92vw,1320px)] md:flex-row md:rounded-2xl md:border md:border-white/10">
          <div className="relative flex h-[43dvh] shrink-0 items-center justify-center bg-[#090a0c] md:h-full md:min-h-0 md:flex-1">
            <img
              src={post.image_url}
              alt={post.description || "Gönderi görseli"}
              className="h-full w-full object-contain"
              loading="eager"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-white/10 bg-[#1c1d20] md:h-full md:w-[min(57%,750px)] md:flex-none md:border-l md:border-t-0">
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                {post.tenant?.profile_image_url ? (
                  <img
                    src={post.tenant.profile_image_url}
                    alt={post.tenant.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-white/75" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center leading-none">
                <p className="truncate text-[14px] font-semibold leading-snug text-white">
                  {post.tenant?.name || "İşletme"}
                </p>
                <p className="mt-1 truncate text-[12px] leading-tight text-white/60">
                  {formatRelativeTime(post.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white md:hidden"
                aria-label={t("modal.close") || "Kapat"}
              >
                <X className="h-5 w-5" />
              </button>
              <span
                className="inline-flex rounded-full p-2 text-white/75"
                aria-hidden="true"
              >
                <MoreHorizontal className="h-5 w-5" />
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar md:px-5">
              {post.description && (
                <div className="mb-5 flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                    {post.tenant?.profile_image_url ? (
                      <img
                        src={post.tenant.profile_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-white/70" />
                    )}
                  </div>
                  <p className="min-w-0 pt-1 text-[14px] leading-[1.45] text-white/95">
                    <span className="mr-1.5 font-semibold">
                      {post.tenant?.name || "İşletme"}
                    </span>
                    <span className="whitespace-pre-wrap">
                      {renderTextWithMentions(post.description)}
                    </span>
                    <span className="ml-2 whitespace-nowrap text-[12px] text-white/45">
                      {formatRelativeTime(post.created_at)}
                    </span>
                  </p>
                </div>
              )}

              <div className="space-y-5">
                {loadingComments ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3 animate-pulse">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-1/4 rounded bg-white/10" />
                          <div className="h-3 w-3/4 rounded bg-white/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <div className="py-8 text-center text-white/55">
                    <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    <p className="text-sm">
                      {t("posts.no_comments") ||
                        "Henüz yorum yok. İlk yorumu siz yapın!"}
                    </p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      currentUserId={user?.id}
                    />
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>
            </div>

            <div className="shrink-0 border-t border-white/10 px-4 pb-3 pt-3 md:px-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleLikeClick}
                    className="rounded-sm text-white transition-transform hover:scale-105"
                    aria-label={
                      liked
                        ? t("posts.unlike") || "Beğeniyi geri al"
                        : t("posts.like") || "Beğen"
                    }
                    aria-pressed={liked}
                  >
                    <Heart
                      className={`h-7 w-7 ${liked ? "fill-rose-500 text-rose-500" : ""}`}
                      strokeWidth={1.8}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => commentInputRef.current?.focus()}
                    className="rounded-sm text-white transition-transform hover:scale-105"
                    aria-label={t("posts.comment") || "Yorum yap"}
                  >
                    <MessageCircle className="h-7 w-7" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="rounded-sm text-white transition-transform hover:scale-105"
                    aria-label={lang === "tr" ? "Paylaş" : "Share"}
                  >
                    <Send className="h-6 w-6" strokeWidth={1.8} />
                  </button>
                </div>
                <span
                  className="inline-flex rounded-sm text-white"
                  aria-hidden="true"
                >
                  <Bookmark className="h-6 w-6" strokeWidth={1.8} />
                </span>
              </div>
              <p className="text-[14px] font-semibold text-white">
                {formatNumber(likeCount)} {lang === "tr" ? "beğeni" : "likes"}
              </p>
              <p className="mb-3 mt-1 text-[12px] text-white/50">
                {formatRelativeTime(post.created_at)}
              </p>

              {requireAuth || loadingUser ? (
                <div className="border-t border-white/10 py-3 text-sm text-white/55">
                  <span>
                    {t("posts.login_to_comment") || "Giriş yaparak yorum yapın"}
                  </span>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmitComment}
                  className="flex items-center gap-2 border-t border-white/10 pt-3"
                >
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <User className="h-4 w-4 text-white/70" />
                    </div>
                  )}
                  <div className="flex min-h-9 flex-1 items-center gap-2">
                    <input
                      ref={commentInputRef}
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={t("posts.add_comment") || "Yorum ekle..."}
                      className="flex-1 bg-transparent px-0 py-0 text-[13px] leading-5 text-white placeholder:text-white/45 focus:outline-none"
                      maxLength={500}
                      disabled={submittingComment}
                      aria-label={t("posts.add_comment") || "Yorum ekle"}
                    />
                    <button
                      type="submit"
                      disabled={
                        !newComment.trim() ||
                        submittingComment ||
                        requireAuth ||
                        loadingUser
                      }
                      className="shrink-0 rounded-full p-1.5 text-sm font-semibold text-[var(--brand)] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={t("posts.send") || "Gönder"}
                    >
                      {lang === "tr" ? "Gönder" : "Post"}
                    </button>
                  </div>
                </form>
              )}
            </div>
      </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 hidden rounded-full p-2 text-white transition-colors hover:bg-white/10 md:block"
        aria-label={t("modal.close") || "Kapat"}
      >
        <X className="h-7 w-7" />
      </button>

      {previousPost && onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate(previousPost.id)}
          className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform hover:scale-105 md:left-5"
          aria-label={lang === "tr" ? "Önceki fotoğraf" : "Previous photo"}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {nextPost && onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate(nextPost.id)}
          className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform hover:scale-105 md:right-5"
          aria-label={lang === "tr" ? "Sonraki fotoğraf" : "Next photo"}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>,
    document.body,
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
          <User className="h-4 w-4 text-white/70" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-white">
            {comment.username}
          </span>
          <span className="text-[11px] text-white/45">
            {formatRelativeTime(comment.created_at)}
          </span>
          {isOwn && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70">
              {t("posts.you") || "Sen"}
            </span>
          )}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-6 text-white/95">
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
    "posts.login_to_like": "Beğenmek için giriş yapın",
  };
  return dict[key] || key;
}
