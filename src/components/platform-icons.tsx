import React from 'react';
import {
  Linkedin, Twitter, Facebook, Instagram, Github, Globe, GraduationCap, BookOpen
} from 'lucide-react';

export const platformIcons: Record<string, React.ReactNode> = {
  LinkedIn: <Linkedin className="h-4 w-4" />,
  'Twitter/X': <Twitter className="h-4 w-4" />,
  Facebook: <Facebook className="h-4 w-4" />,
  Instagram: <Instagram className="h-4 w-4" />,
  GitHub: <Github className="h-4 w-4" />,
  Web: <Globe className="h-4 w-4" />,
  YouTube: <Globe className="h-4 w-4" />,
  TikTok: <Globe className="h-4 w-4" />,
  Reddit: <Globe className="h-4 w-4" />,
  Medium: <Globe className="h-4 w-4" />,
  Pinterest: <Globe className="h-4 w-4" />,
  GoogleScholar: <GraduationCap className="h-4 w-4" />,
  ResearchGate: <BookOpen className="h-4 w-4" />,
};
