import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ErrorPopup from "@/components/error-popup";
import MD3LoadingIndicator from "./md3-loading-indicator";


interface VideoPreviewProps {
  videoUrl: string;
  taskId: string;
  onVideoLoad: (url: string) => void;
}

export default function VideoPreview({ videoUrl, taskId, onVideoLoad }: VideoPreviewProps) {
  const [pollingTaskId, setPollingTaskId] = useState<string>("");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [popup, setPopup] = useState<{ 
    isOpen: boolean; 
    title: string; 
    description: string; 
    type: "error" | "warning" | "info" 
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "error"
  });
  const { toast } = useToast();

  const showPopup = (title: string, description: string, type: "error" | "warning" | "info" = "error") => {
    setPopup({ isOpen: true, title, description, type });
  };

  const closePopup = () => {
    setPopup({ isOpen: false, title: "", description: "", type: "error" });
  };

  const { data: videoStatus, isLoading, error } = useQuery<any>({
    queryKey: ["/api/video-status", pollingTaskId],
    enabled: !!pollingTaskId,
    refetchInterval: (query) => {
      // Stop polling if completed or failed
      if (query.state.data?.successFlag === 1 || query.state.data?.successFlag === -1) {
        return false;
      }
      // Stop polling if there's a credits error
      if (query.state.error) {
        return false;
      }
      return 5000; // Poll every 5 seconds
    },
  });

  useEffect(() => {
    if (taskId && taskId !== pollingTaskId) {
      setPollingTaskId(taskId);
      setStartTime(new Date());
      setProgress(0);
    }
  }, [taskId, pollingTaskId]);

  // Update progress based on elapsed time
  useEffect(() => {
    if (!startTime || !pollingTaskId || videoUrl) return;

    const interval = setInterval(() => {
      const elapsedSeconds = (new Date().getTime() - startTime.getTime()) / 1000;
      // Estimate 120 seconds (2 minutes) for completion, with some variation
      const estimatedDuration = 120;
      const calculatedProgress = Math.min((elapsedSeconds / estimatedDuration) * 85, 85); // Cap at 85% until actual completion
      setProgress(calculatedProgress);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, pollingTaskId, videoUrl]);

  useEffect(() => {
    if (videoStatus?.successFlag === 1 && videoStatus?.response?.resultUrls?.[0]) {
      setProgress(100);
      const url = videoStatus.response.resultUrls[0];
      onVideoLoad(url);
      toast({
        title: "Tạo video thành công!",
        description: "Video của bạn đã sẵn sàng để xem trước.",
      });
    } else if (videoStatus?.successFlag === -1) {
      setProgress(0);
      showPopup(
        "Máy chủ quá tải", 
        "Máy chủ đang xử lý quá nhiều yêu cầu. Vui lòng thử lại sau vài phút.", 
        "error"
      );
    }
  }, [videoStatus, onVideoLoad, toast]);

  // Handle API errors (insufficient credits)
  useEffect(() => {
    if (error && pollingTaskId) {
      const errorResponse = (error as any)?.response;
      if (errorResponse?.status === 503) {
        setProgress(0);
        setPollingTaskId(""); // Stop polling
        
        // Parse error response
        if (errorResponse?.data?.error === "INSUFFICIENT_CREDITS") {
          showPopup(
            "Hết credits", 
            "Tất cả API keys đã hết credits. Vui lòng thêm credits hoặc thêm API key mới để tiếp tục.", 
            "warning"
          );
        } else {
          showPopup(
            "Lỗi hệ thống", 
            "Không thể kiểm tra trạng thái video. Vui lòng thử lại sau.", 
            "error"
          );
        }
      }
    }
  }, [error, pollingTaskId]);

  const handleGet1080p = async () => {
    try {
      const response = await fetch(`/api/get-1080p/${taskId}`);
      const data = await response.json();
      
      if (data.resultUrl) {
        // Create download link
        const link = document.createElement('a');
        link.href = data.resultUrl;
        link.download = 'video-1080p.mp4';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Phiên bản 1080P sẵn sàng",
          description: "Đã bắt đầu tải video chất lượng cao.",
        });
      }
    } catch (error) {
      showPopup(
        "Không thể lấy phiên bản 1080P", 
        "Máy chủ quá tải. Vui lòng thử lại sau ít phút.", 
        "error"
      );
    }
  };

  const handleDownload = () => {
    if (videoUrl) {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = 'generated-video.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-hidden">
      <div className="p-4 border-b border-dark-600">
        <h3 className="font-semibold text-lg">Preview</h3>
      </div>
      
      <div className="p-4">
        {!videoUrl && !pollingTaskId && (
          <div 
            className="aspect-video bg-dark-600 rounded-lg flex items-center justify-center border border-dark-500"
            data-testid="preview-placeholder"
          >
            <div className="text-center text-gray-400">
              <Play className="w-16 h-16 mx-auto mb-4 text-gray-500" />
              <p className="text-sm">Your generated video will appear here</p>
            </div>
          </div>
        )}

        {pollingTaskId && !videoUrl && (
          <div 
            className="aspect-video bg-dark-600 rounded-lg flex items-center justify-center border border-dark-500"
            data-testid="preview-loading"
          >
            <div className="text-center text-gray-400 w-full max-w-md px-8">
              <div className="mb-4">
                <MD3LoadingIndicator 
                  size="medium" 
                  label="Creating video" 
                  data-testid="loading-video-creation"
                />
              </div>
              <p className="text-sm mb-4">Đang tạo video của bạn...</p>
              
              <div className="mb-3">
                <Progress 
                  value={progress} 
                  className="h-3 bg-dark-500"
                  data-testid="progress-bar"
                />
              </div>
              
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span data-testid="progress-percentage">{Math.round(progress)}%</span>
                <span>~{Math.max(0, 120 - Math.round((new Date().getTime() - (startTime?.getTime() || 0)) / 1000))}s còn lại</span>
              </div>
              
              {isLoading && <p className="text-xs text-gray-500 mt-2">Checking status...</p>}
            </div>
          </div>
        )}
        
        {videoUrl && (
          <div data-testid="video-player">
            <video 
              controls 
              className="w-full rounded-lg bg-black"
              data-testid="video-element"
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            
            <div className="flex justify-between items-center mt-4">
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-100 text-green-800" data-testid="status-completed">
                  ✓ Generated
                </Badge>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outlined"
                  onClick={handleDownload}
                  className="bg-dark-600 hover:bg-dark-500 border-dark-500 text-white"
                  data-testid="button-download"
                >
                  <Download className="w-4 h-4" />
                  Tải xuống
                </Button>
                {taskId && (
                  <Button
                    size="sm"
                    onClick={handleGet1080p}
                    className="bg-primary-600 hover:bg-primary-700 text-white"
                    data-testid="button-get-1080p"
                  >
                    Get 1080P
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <ErrorPopup 
        isOpen={popup.isOpen}
        onClose={closePopup}
        title={popup.title}
        description={popup.description}
        type={popup.type}
      />
    </div>
  );
}
