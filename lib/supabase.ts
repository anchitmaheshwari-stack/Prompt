import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Blog = {
  id: string;
  doc_id: string;
  doc_url: string;
  title: string;
  freelancer: string;
  status: string;
  created_at: string;
};

export type Section = {
  id: string;
  blog_id: string;
  position: number;
  h2: string;
  h3: string;
  content: string;
  content_final: string | null;
  resolved: boolean;
};

export type Issue = {
  id: string;
  section_id: string;
  quote: string;
  category: string;
  issue_text: string;
  suggested_fix: string;
  confidence: string;
  check_type: string;
};