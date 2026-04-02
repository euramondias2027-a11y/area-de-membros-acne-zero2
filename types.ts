
export interface Lesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
}

export interface User {
  email: string;
  isAuthenticated: boolean;
  purchasedCategories?: string[];
  revokedCategories?: string[];
}

export type VideoPlatform = 'youtube' | 'wistia' | 'unknown';
