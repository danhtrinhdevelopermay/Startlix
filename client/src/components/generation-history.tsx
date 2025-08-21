import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Download, Loader2, AlertCircle, Clock } from "lucide-react";
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
        return <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />;
      case "failed":
        return <AlertCircle className="w-3 h-3 text-red-400" />;
      default:
        return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "processing":
        return "Generating...";
      case "failed":
        return "Failed";
      case "pending":
        return "Pending";
      default:
        return "Unknown";
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
      <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-hidden">
        <div className="p-4 border-b border-dark-600">
          <h3 className="font-semibold text-lg">Recent Generations</h3>
        </div>
        <div className="p-4 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-hidden">
      <div className="p-4 border-b border-dark-600">
        <h3 className="font-semibold text-lg">Recent Generations</h3>
      </div>
      
      <div className="p-4 space-y-3" data-testid="generation-list">
        {generations.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No generations yet</p>
            <p className="text-xs mt-1">Your generated videos will appear here</p>
          </div>
        ) : (
          generations.map((generation: any) => (
            <div
              key={generation.id}
              className={`bg-dark-600 rounded-lg p-4 border transition-colors ${
                generation.status === "completed" 
                  ? "border-dark-500 cursor-pointer hover:bg-dark-500" 
                  : generation.status === "failed"
                  ? "border-red-500/30"
                  : "border-dark-500"
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
                  <Badge variant="outline" className="text-xs border-dark-400 text-gray-300">
                    {generation.type === "text-to-video" ? "Text" : "Image"}
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
                  <span>Model: {generation.model}</span>
                  <span>•</span>
                  <span>Ratio: {generation.aspectRatio}</span>
                  {generation.status === "completed" && generation.resultUrls?.[0] && (
                    <>
                      <span>•</span>
                      <span>Ready</span>
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
                      title="Preview"
                      data-testid="button-preview"
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 bg-dark-500 hover:bg-dark-400"
                      onClick={(e) => handleDownload(generation.resultUrls[0], e)}
                      title="Download"
                      data-testid="button-download-history"
                    >
                      <Download className="w-3 h-3" />
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
