import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayRegular, ArrowDownloadRegular, ArrowClockwiseRegular, ErrorCircleRegular, ClockRegular } from "@fluentui/react-icons";
import { formatDistanceToNow } from "date-fns";

interface GenerationHistoryProps {
  onSelectVideo: (url: string) => void;
}

export default function GenerationHistory({ onSelectVideo }: GenerationHistoryProps) {
  const { data: generations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/generations"],
    refetchInterval: 10000, // Refresh every 10 seconds for live updates
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <div className="w-3 h-3 bg-green-400 rounded-full" />;
      case "processing":
        return <ArrowClockwiseRegular className="w-3 h-3 text-yellow-400 animate-spin" />;
      case "failed":
        return <ErrorCircleRegular className="w-3 h-3 text-red-400" />;
      default:
        return <ClockRegular className="w-3 h-3 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Hoàn thành";
      case "processing":
        return "Đang tạo...";
      case "failed":
        return "Thất bại";
      case "pending":
        return "Chờ xử lý";
      default:
        return "Không rõ";
    }
  };

  const handleSelectVideo = (generation: any) => {
    if (generation.status === "completed" && generation.resultUrls?.[0]) {
      onSelectVideo(generation.resultUrls[0]);
    }
  };

  const handleDownload = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = url;
    link.download = 'video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading && generations.length === 0) {
    return (
      <div className="bg-[var(--md-sys-color-surface-container)] rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[var(--md-sys-color-outline-variant)]">
          <h3 className="font-semibold text-lg">Lịch sử tạo video</h3>
        </div>
        <div className="p-4 flex items-center justify-center">
          <ArrowClockwiseRegular className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="fluent-glass-strong rounded-[var(--fluent-border-radius-large)] border border-[var(--fluent-neutral-stroke-1)] overflow-hidden fluent-shadow-large transition-all duration-300 hover:fluent-shadow-ultra hover:scale-[1.02]">
      <div className="p-6 border-b border-[var(--fluent-neutral-stroke-1)] bg-gradient-to-r from-[var(--fluent-brand-secondary)]/5 to-[var(--fluent-brand-primary)]/5">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-gradient-to-r from-[var(--fluent-brand-secondary)] to-[var(--fluent-brand-primary)] rounded-full"></div>
          <h3 className="fluent-title-large text-[var(--fluent-neutral-foreground-1)] font-semibold">Video đã tạo gần đây</h3>
        </div>
      </div>
      
      <div className="p-6 space-y-4" data-testid="generation-list">
        {generations.length === 0 ? (
          <div className="text-center py-12 text-[var(--fluent-neutral-foreground-3)]">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto rounded-full fluent-glass-subtle flex items-center justify-center">
                <ClockRegular className="w-8 h-8 text-[var(--fluent-brand-primary)]" />
              </div>
            </div>
            <p className="fluent-body-medium text-[var(--fluent-neutral-foreground-2)]">Chưa có video nào</p>
            <p className="fluent-caption text-[var(--fluent-neutral-foreground-3)] mt-2">Các video đã tạo sẽ hiển thị ở đây</p>
          </div>
        ) : (
          generations.map((generation: any) => (
            <div
              key={generation.id}
              className={`fluent-glass-subtle rounded-[var(--fluent-border-radius-large)] p-5 border transition-all duration-300 hover:fluent-shadow-medium ${
                generation.status === "completed" 
                  ? "border-[var(--fluent-neutral-stroke-1)] cursor-pointer hover:fluent-glass hover:scale-[1.02]" 
                  : generation.status === "failed"
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-[var(--fluent-neutral-stroke-1)]"
              }`}
              onClick={() => handleSelectVideo(generation)}
              data-testid={`generation-item-${generation.id}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(generation.status)}
                  <span className="fluent-body-medium font-medium text-[var(--fluent-neutral-foreground-1)]">
                    {getStatusText(generation.status)}
                  </span>
                  <Badge variant="outline" className="fluent-caption border-[var(--fluent-neutral-stroke-1)] text-[var(--fluent-neutral-foreground-2)] bg-[var(--fluent-neutral-background-1)]/50">
                    {generation.type === "text-to-video" ? "Văn bản" : "Hình ảnh"}
                  </Badge>
                </div>
                <span className="fluent-caption text-[var(--fluent-neutral-foreground-3)]" data-testid="generation-timestamp">
                  {generation.createdAt && formatDistanceToNow(new Date(generation.createdAt), { addSuffix: true })}
                </span>
              </div>
              
              <p 
                className="fluent-body-medium text-[var(--fluent-neutral-foreground-2)] mb-4 line-clamp-2 leading-relaxed" 
                title={generation.prompt}
                data-testid="generation-prompt"
              >
                {generation.prompt}
              </p>
              
              {generation.status === "failed" && generation.errorMessage && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-[var(--fluent-border-radius-medium)] p-3 mb-4">
                  <p 
                    className="fluent-caption text-red-400"
                    data-testid="generation-error"
                  >
                    {generation.errorMessage}
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 fluent-caption text-[var(--fluent-neutral-foreground-3)]">
                  <span className="bg-[var(--fluent-neutral-background-1)]/50 px-2 py-1 rounded-[var(--fluent-border-radius-small)]">Mô hình: {generation.model}</span>
                  <span className="bg-[var(--fluent-neutral-background-1)]/50 px-2 py-1 rounded-[var(--fluent-border-radius-small)]">Tỷ lệ: {generation.aspectRatio}</span>
                  {generation.status === "completed" && generation.resultUrls?.[0] && (
                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-[var(--fluent-border-radius-small)]">Sẵn sàng</span>
                  )}
                </div>
                
                {generation.status === "completed" && generation.resultUrls?.[0] && (
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 fluent-glass-subtle hover:fluent-glass rounded-[var(--fluent-border-radius-medium)] transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVideo(generation.resultUrls[0]);
                      }}
                      title="Xem trước"
                      data-testid="button-preview"
                    >
                      <PlayRegular className="w-4 h-4 text-[var(--fluent-brand-primary)]" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 fluent-glass-subtle hover:fluent-glass rounded-[var(--fluent-border-radius-medium)] transition-all duration-200"
                      onClick={(e) => handleDownload(generation.resultUrls[0], e)}
                      title="Tải xuống"
                      data-testid="button-download-history"
                    >
                      <ArrowDownloadRegular className="w-4 h-4 text-[var(--fluent-brand-primary)]" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
