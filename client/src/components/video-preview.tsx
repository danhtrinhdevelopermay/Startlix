import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoPreviewProps {
  videoUrl: string;
  taskId: string;
  onVideoLoad: (url: string) => void;
}

export default function VideoPreview({ videoUrl, taskId, onVideoLoad }: VideoPreviewProps) {
  const [pollingTaskId, setPollingTaskId] = useState<string>("");
  const { toast } = useToast();

  const { data: videoStatus, isLoading } = useQuery<any>({
    queryKey: ["/api/video-status", pollingTaskId],
    enabled: !!pollingTaskId,
    refetchInterval: (data) => {
      // Stop polling if completed or failed
      if ((data as any)?.successFlag === 1 || (data as any)?.successFlag === -1) {
        return false;
      }
      return 5000; // Poll every 5 seconds
    },
  });

  useEffect(() => {
    if (taskId && taskId !== pollingTaskId) {
      setPollingTaskId(taskId);
    }
  }, [taskId, pollingTaskId]);

  useEffect(() => {
    if (videoStatus?.successFlag === 1 && videoStatus?.response?.resultUrls?.[0]) {
      const url = videoStatus.response.resultUrls[0];
      onVideoLoad(url);
      toast({
        title: "Video generated successfully!",
        description: "Your video is ready for preview.",
      });
    } else if (videoStatus?.successFlag === -1) {
      toast({
        title: "Generation failed",
        description: videoStatus.errorMessage || "Video generation failed",
        variant: "destructive",
      });
    }
  }, [videoStatus, onVideoLoad, toast]);

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
          title: "1080P version ready",
          description: "High definition video download started.",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to get 1080P version",
        description: "Please try again later.",
        variant: "destructive",
      });
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
            <div className="text-center text-gray-400">
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-primary-500 animate-spin" />
              <p className="text-sm mb-2">Generating your video...</p>
              {isLoading && <p className="text-xs text-gray-500">Checking status...</p>}
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
                  variant="outline"
                  onClick={handleDownload}
                  className="bg-dark-600 hover:bg-dark-500 border-dark-500 text-white"
                  data-testid="button-download"
                >
                  <Download className="w-4 h-4" />
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
    </div>
  );
}
