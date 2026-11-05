"use client";

import { createContext, useContext, type ReactNode } from "react";

export type BlogReadingClickInput = {
  ctaName: string;
  destinationType: "course" | "service";
  targetPath: string;
};

type BlogReadingContextValue = {
  blogPostId: string;
  reportCommercialClick: (input: BlogReadingClickInput) => void;
};

const BlogReadingContext = createContext<BlogReadingContextValue | null>(null);

export function BlogReadingProvider({ value, children }: { value: BlogReadingContextValue; children: ReactNode }) {
  return <BlogReadingContext.Provider value={value}>{children}</BlogReadingContext.Provider>;
}

export function useBlogReadingOptional() {
  return useContext(BlogReadingContext);
}
