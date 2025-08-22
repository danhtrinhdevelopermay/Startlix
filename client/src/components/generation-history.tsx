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
    <div className="bg-[var(--md-sys-color-surface-container)] rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] overflow-hidden shadow-sm">
      <div className="p-4 border-b border-dark-600">
        <h3 className="font-semibold text-lg">Video đã tạo gần đây</h3>
      </div>
      
      <div className="p-4 space-y-3" data-testid="generation-list">
        {generations.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Chưa có video nào</p>
            <p className="text-xs mt-1">Các video đã tạo sẽ hiển thị ở đây</p>
          </div>
        ) : (
          generations.map((generation: any) => (
            <div
              key={generation.id}
              className={`bg-[var(--md-sys-color-surface-container-low)] rounded-[var(--md-sys-shape-corner-medium)] p-4 border transition-colors ${
                generation.status === "completed" 
                  ? "border-[var(--md-sys-color-outline-variant)] cursor-pointer hover:bg-[var(--md-sys-color-surface-container-high)]" 
                  : generation.status === "failed"
                  ? "border-red-500/30"
                  : "border-[var(--md-sys-color-outline-variant)]"
              }`}
              onClick={() => handleSelectVideo(generation)}
              data-testid={`generation-item-${generation.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(generation.status)}
                  <span className="text-sm font-medium">
                    {getStatusText(generation.status)}
                  </span>
                  <Badge variant="outline" className="text-xs border-[var(--md-sys-color-outline)] text-[var(--md-sys-color-on-surface-variant)]">
                    {generation.type === "text-to-video" ? "Văn bản" : "Hình ảnh"}
                  </Badge>
                </div>
                <span className="text-xs text-gray-400" data-testid="generation-timestamp">
                  {generation.createdAt && formatDistanceToNow(new Date(generation.createdAt), { addSuffix: true })}
                </span>
              </div>
              
              <p 
                className="text-sm text-gray-300 mb-3 line-clamp-2" 
                title={generation.prompt}
                data-testid="generation-prompt"
              >
                {generation.prompt}
              </p>
              
              {generation.status === "failed" && generation.errorMessage && (
                <p 
                  className="text-xs text-red-400 mb-3"
                  data-testid="generation-error"
                >
                  {generation.errorMessage}
                </p>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-gray-400">
                  <span>Mô hình: {generation.model}</span>
                  <span>•</span>
                  <span>Tỷ lệ: {generation.aspectRatio}</span>
                  {generation.status === "completed" && generation.resultUrls?.[0] && (
                    <>
                      <span>•</span>
                      <span>Sẵn sàng</span>
                    </>
                  )}
                </div>
                
                {generation.status === "completed" && generation.resultUrls?.[0] && (
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 bg-dark-500 hover:bg-dark-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVideo(generation.resultUrls[0]);
                      }}
                      title="Xem trước"
                      data-testid="button-preview"
                    >
                      <PlayRegular className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 bg-dark-500 hover:bg-dark-400"
                      onClick={(e) => handleDownload(generation.resultUrls[0], e)}
                      title="Tải xuống"
                      data-testid="button-download-history"
                    >
                      <ArrowDownloadRegular className="w-3 h-3" />
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
