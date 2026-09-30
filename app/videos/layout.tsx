import './videos.css';

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return <div className="viz-root min-h-screen flex-1">{children}</div>;
}
