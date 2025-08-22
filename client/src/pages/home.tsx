import VideoGenerator from "@/components/video-generator";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--md-sys-color-background)] text-[var(--md-sys-color-on-background)] relative">
      <VideoGenerator />
    </div>
  );
}
