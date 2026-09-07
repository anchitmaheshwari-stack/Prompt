import { redirect } from 'next/navigation';

// The deployed site is the prompt analysis. The blog fact-check inbox
// (Supabase-backed) still lives at /blog.
export default function Home() {
  redirect('/prompts');
}
