import { createClient } from '@supabase/supabase-js';

import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Created on first use, not at import time, so `next build` succeeds without
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (the blog pages are
 * force-dynamic and only touch Supabase at request time).
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  client = createClient(url, key);
  return client;
}

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