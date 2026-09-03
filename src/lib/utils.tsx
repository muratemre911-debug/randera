"use client";

import React from "react";

export interface Mention {
  username: string;
  index: number;
  length: number;
}

export function parseMentions(text: string): Mention[] {
  const mentions: Mention[] = [];
  const regex = /@(\w+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      username: match[1],
      index: match.index,
      length: match[0].length,
    });
  }

  return mentions;
}

export function renderTextWithMentions(text: string): React.ReactNode {
  const mentions = parseMentions(text);
  
  if (mentions.length === 0) {
    return text;
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  mentions.forEach((mention) => {
    if (mention.index > lastIndex) {
      nodes.push(text.slice(lastIndex, mention.index));
    }
    nodes.push(
      <span
        key={mention.index}
        className="text-blue-600 font-semibold cursor-pointer hover:underline dark:text-blue-400"
        onClick={() => handleMentionClick(mention.username)}
      >
        @{mention.username}
      </span>
    );
    lastIndex = mention.index + mention.length;
  });

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function handleMentionClick(username: string) {
  // Navigate to user profile or show user info
  console.log("Mention clicked:", username);
  // You can implement navigation to user profile here
  // e.g., router.push(`/profile/${username}`)
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Az önce";
  }
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} dk önce`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} sa önce`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} gün önce`;
  }
  
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}