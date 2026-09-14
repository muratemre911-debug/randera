"use client";

import React from "react";
import { Star, Trash2, Heart, MessageCircle } from "lucide-react";
import { Post } from "@/types";
import { formatNumber } from "@/lib/utils";

interface PostGridProps {
  posts: Post[];
  onPostClick: (post: Post) => void;
  onDelete?: (postId: string) => void;
  onToggleFeature?: (postId: string) => void;
  featuredPostIds?: string[];
  columns?: 3 | 4;
  isLoading?: boolean;
}

export function PostGrid({
  posts,
  onPostClick,
  onDelete,
  onToggleFeature,
  featuredPostIds = [],
  columns = 3,
  isLoading = false,
}: PostGridProps) {
  if (isLoading) {
    return (
      <div
        className={
          columns === 4
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3"
            : "grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3"
        }
        role="status"
        aria-label="Gönderiler yükleniyor"
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square bg-slate-200 dark:bg-slate-700 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500 dark:text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-white">Henüz gönderi yok</p>
          <p className="text-xs text-slate-400">İşletmenizin fotoğraflarını yükleyerek vitrininizi oluşturun.</p>
        </div>
      </div>
    );
  }

  const gridClass =
    columns === 4
      ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 md:gap-3.5"
      : "grid grid-cols-2 sm:grid-cols-3 gap-2.5 md:gap-3.5";

  return (
    <div className={gridClass} role="list" aria-label="İşletme gönderileri">
      {posts.map((post) => (
        <PostGridItem
          key={post.id}
          post={post}
          onClick={onPostClick}
          onDelete={onDelete}
          onToggleFeature={onToggleFeature}
          isFeatured={featuredPostIds.includes(post.id)}
        />
      ))}
    </div>
  );
}

interface PostGridItemProps {
  post: Post;
  onClick: (post: Post) => void;
  onDelete?: (postId: string) => void;
  onToggleFeature?: (postId: string) => void;
  isFeatured?: boolean;
}

function PostGridItem({ post, onClick, onDelete, onToggleFeature, isFeatured = false }: PostGridItemProps) {
  const [imageError, setImageError] = React.useState(false);

  const handleClick = () => onClick(post);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(post);
    }
  };

  const likeCount = post.like_count || 0;
  const commentCount = post.comment_count || 0;

  return (
    <article
      className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer group rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs"
      role="listitem"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Gönderi: ${post.description?.slice(0, 100) || "Açıklama yok"} - ${formatNumber(likeCount)} beğeni, ${formatNumber(commentCount)} yorum`}
    >
      {imageError ? (
        <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700">
          <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      ) : (
        <img
          src={post.image_url}
          alt={post.description || "İşletme gönderisi"}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      )}

      {isFeatured && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-lg bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs">
          <Star size={11} className="fill-white" />
          <span>Öne Çıkan</span>
        </div>
      )}

      {(onDelete || onToggleFeature) && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {onToggleFeature && (
            <button
              type="button"
              title={isFeatured ? "Öne çıkarmayı kaldır" : "Öne çıkar"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFeature(post.id);
              }}
              className={`p-2 rounded-xl backdrop-blur-md shadow-md transition-all active:scale-90 ${
                isFeatured
                  ? "bg-amber-500 text-white"
                  : "bg-white/90 text-slate-700 hover:bg-amber-500 hover:text-white dark:bg-slate-900/90 dark:text-slate-200"
              }`}
            >
              <Star size={14} className={isFeatured ? "fill-white" : ""} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              title="Sil"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(post.id);
              }}
              className="p-2 rounded-xl bg-white/90 text-rose-600 hover:bg-rose-600 hover:text-white dark:bg-slate-900/90 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white shadow-md transition-all active:scale-90"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}

      <div
        className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex items-center justify-center gap-5 text-white font-semibold text-sm pointer-events-none"
        aria-hidden="true"
      >
        <div className="flex items-center gap-1.5 drop-shadow">
          <Heart size={18} className={post.user_has_liked ? "fill-red-500 text-red-500" : "fill-white text-white"} />
          <span>{formatNumber(likeCount)}</span>
        </div>
        <div className="flex items-center gap-1.5 drop-shadow">
          <MessageCircle size={18} className="fill-white text-white" />
          <span>{formatNumber(commentCount)}</span>
        </div>
      </div>
    </article>
  );
}

const posts = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function PostGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-1 md:gap-4" role="status" aria-label="Gönderiler yükleniyor">
      {posts.map((_, i) => (
        <div key={i} className="aspect-square bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl md:rounded-2xl" />
      ))}
    </div>
  );
}