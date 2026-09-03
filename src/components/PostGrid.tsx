"use client";

import React from "react";
import { Heart, MessageCircle, Loader2 } from "lucide-react";
import { Post } from "@/types";
import { formatNumber } from "@/lib/utils";

interface PostGridProps {
  posts: Post[];
  onPostClick: (post: Post) => void;
  isLoading?: boolean;
}

export function PostGrid({ posts, onPostClick, isLoading = false }: PostGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1 md:gap-4" role="status" aria-label="Gönderiler yükleniyor">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="col-span-3 py-16 text-center text-gray-500 dark:text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium">Henüz gönderi yok</p>
          <p className="text-xs text-gray-400">İşletmenin ilk gönderisini paylaşın</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1 md:gap-4" role="list" aria-label="İşletme gönderileri">
      {posts.map((post) => (
        <PostGridItem key={post.id} post={post} onClick={onPostClick} />
      ))}
    </div>
  );
}

interface PostGridItemProps {
  post: Post;
  onClick: (post: Post) => void;
}

function PostGridItem({ post, onClick }: PostGridItemProps) {
  const [isHovered, setIsHovered] = React.useState(false);
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
      className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer group rounded-xl md:rounded-2xl"
      role="listitem"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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

      <div
        className="absolute inset-0 bg-black/50 flex items-center justify-center gap-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none"
        aria-hidden="true"
      >
        {isHovered || posts.length > 1 ? (
          <>
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full p-2.5 shadow-lg transform transition-transform hover:scale-110">
              <Heart className="h-5 w-5 text-red-500" aria-hidden="true" />
            </div>
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full p-2.5 shadow-lg transform transition-transform hover:scale-110">
              <MessageCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            </div>
          </>
        ) : null}
      </div>

      <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none">
        <Heart className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
        <span>{formatNumber(likeCount)}</span>
        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{formatNumber(commentCount)}</span>
      </div>

      <div
        className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
        aria-hidden="true"
      />
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