import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PlayRegular, ArrowDownloadRegular, PauseRegular, SpeakerMuteRegular, Speaker2Regular, FullScreenMaximizeRegular } from "@fluentui/react-icons";
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
  
  // Video player states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16/9);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const showPopup = (title: string, description: string, type: "error" | "warning" | "info" = "error") => {
    setPopup({ isOpen: true, title, description, type });
  };

  const closePopup = () => {
    setPopup({ isOpen: false, title: "", description: "", type: "error" });
  };

  // Video player control functions
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = time;
    setCurrentTime(time);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.fullscreenElement) {
      video.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      // Calculate and set video aspect ratio
      const aspectRatio = video.videoWidth / video.videoHeight;
      setVideoAspectRatio(aspectRatio);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      resetControlsTimeout();
    };

    const handlePause = () => {
      setIsPlaying(false);
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [videoUrl]);

  // Reset video states when videoUrl changes
  useEffect(() => {
    if (videoUrl) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setShowControls(true);
      setVideoAspectRatio(16/9); // Reset to default until metadata loads
    }
  }, [videoUrl]);

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
    <div className="fluent-glass-strong rounded-[var(--fluent-border-radius-large)] border border-[var(--fluent-neutral-stroke-1)] overflow-hidden fluent-shadow-large transition-all duration-300 hover:fluent-shadow-ultra hover:scale-[1.02]">
      <div className="p-6 border-b border-[var(--fluent-neutral-stroke-1)] bg-gradient-to-r from-[var(--fluent-brand-primary)]/5 to-[var(--fluent-brand-secondary)]/5">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-gradient-to-r from-[var(--fluent-brand-primary)] to-[var(--fluent-brand-secondary)] rounded-full"></div>
          <h3 className="fluent-title-large text-[var(--fluent-neutral-foreground-1)] font-semibold">Xem trước</h3>
        </div>
      </div>
      
      <div className="p-6">
        {!videoUrl && !pollingTaskId && (
          <div 
            className="aspect-video fluent-glass-subtle rounded-[var(--fluent-border-radius-large)] flex items-center justify-center border border-[var(--fluent-neutral-stroke-1)] backdrop-blur-xl relative overflow-hidden"
            data-testid="preview-placeholder"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--fluent-brand-primary)]/5 via-transparent to-[var(--fluent-brand-secondary)]/5"></div>
            <div className="text-center text-[var(--fluent-neutral-foreground-3)] relative z-10">
              <div className="mb-6">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--fluent-brand-primary)] to-[var(--fluent-brand-secondary)] rounded-full blur-lg opacity-30"></div>
                  <PlayRegular className="w-16 h-16 text-[var(--fluent-brand-primary)] relative z-10" />
                </div>
              </div>
              <p className="fluent-body-medium text-[var(--fluent-neutral-foreground-2)]">Video đã tạo sẽ hiển thị ở đây</p>
              <p className="fluent-caption text-[var(--fluent-neutral-foreground-3)] mt-2">Hãy bắt đầu tạo video đầu tiên của bạn</p>
            </div>
          </div>
        )}

        {pollingTaskId && !videoUrl && (
          <div 
            className="aspect-video fluent-glass-subtle rounded-[var(--fluent-border-radius-large)] flex items-center justify-center border border-[var(--fluent-neutral-stroke-1)] backdrop-blur-xl relative overflow-hidden"
            data-testid="preview-loading"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--fluent-brand-primary)]/10 via-transparent to-[var(--fluent-brand-secondary)]/10 animate-pulse"></div>
            <div className="text-center text-[var(--fluent-neutral-foreground-2)] w-full max-w-md px-8 relative z-10">
              <div className="mb-4">
                <MD3LoadingIndicator 
                  size="medium" 
                  label="Đang tạo video" 
                  data-testid="loading-video-creation"
                />
              </div>
              <p className="fluent-body-medium mb-6 text-[var(--fluent-neutral-foreground-1)]">Đang tạo video của bạn...</p>
              
              <div className="mb-4">
                <Progress 
                  value={progress} 
                  className="h-4 fluent-glass-subtle backdrop-blur-sm"
                  data-testid="progress-bar"
                />
              </div>
              
              <div className="flex justify-between items-center fluent-caption text-[var(--fluent-neutral-foreground-3)]">
                <span data-testid="progress-percentage" className="font-semibold text-[var(--fluent-brand-primary)]">{Math.round(progress)}%</span>
                <span>~{Math.max(0, 120 - Math.round((new Date().getTime() - (startTime?.getTime() || 0)) / 1000))}s còn lại</span>
              </div>
              
              {isLoading && <p className="fluent-caption text-[var(--fluent-neutral-foreground-3)] mt-3">Đang kiểm tra trạng thái...</p>}
            </div>
          </div>
        )}
        
        {videoUrl && (
          <div data-testid="video-player">
            <div 
              className="relative w-full rounded-[var(--fluent-border-radius-large)] overflow-hidden bg-black fluent-shadow-medium group cursor-pointer"
              style={{ 
                aspectRatio: videoAspectRatio.toString()
              }}
              onMouseMove={resetControlsTimeout}
              onMouseLeave={() => {
                if (isPlaying) {
                  setShowControls(false);
                }
              }}
              onClick={togglePlay}
            >
              <video 
                ref={videoRef}
                className="w-full h-full object-contain"
                data-testid="video-element"
                onDoubleClick={toggleFullscreen}
                controls={false}
              >
                <source src={videoUrl} type="video/mp4" />
                Trình duyệt của bạn không hỗ trợ video.
              </video>
              
              {/* Custom Controls Overlay with Backdrop Blur */}
              <div 
                className={`absolute inset-0 transition-opacity duration-300 ${
                  showControls ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {/* Center Play/Pause Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                    className="bg-black/50 backdrop-blur-md rounded-full p-4 text-white hover:bg-black/70 transition-all duration-200 hover:scale-110"
                    data-testid="button-play-pause-center"
                  >
                    {isPlaying ? (
                      <PauseRegular className="w-8 h-8" />
                    ) : (
                      <PlayRegular className="w-8 h-8" />
                    )}
                  </button>
                </div>

                {/* Bottom Controls Bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent backdrop-blur-md p-4">
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div 
                      className="w-full h-1 bg-white/30 rounded-full cursor-pointer relative group/progress"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percentage = x / rect.width;
                        const newTime = percentage * duration;
                        handleSeek(newTime);
                      }}
                    >
                      <div 
                        className="h-full bg-gradient-to-r from-[var(--fluent-brand-primary)] to-[var(--fluent-brand-secondary)] rounded-full transition-all duration-200 group-hover/progress:h-2"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity duration-200"
                        style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Controls Row */}
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center space-x-3">
                      {/* Play/Pause */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlay();
                        }}
                        className="hover:text-[var(--fluent-brand-primary)] transition-colors duration-200"
                        data-testid="button-play-pause"
                      >
                        {isPlaying ? (
                          <PauseRegular className="w-5 h-5" />
                        ) : (
                          <PlayRegular className="w-5 h-5" />
                        )}
                      </button>

                      {/* Volume */}
                      <div className="flex items-center space-x-2 group/volume">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMute();
                          }}
                          className="hover:text-[var(--fluent-brand-primary)] transition-colors duration-200"
                          data-testid="button-mute"
                        >
                          {isMuted || volume === 0 ? (
                            <SpeakerMuteRegular className="w-5 h-5" />
                          ) : (
                            <Speaker2Regular className="w-5 h-5" />
                          )}
                        </button>
                        
                        {/* Volume Slider */}
                        <div className="w-0 group-hover/volume:w-20 overflow-hidden transition-all duration-300">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={isMuted ? 0 : volume}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleVolumeChange(parseFloat(e.target.value));
                            }}
                            className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
                            data-testid="volume-slider"
                          />
                        </div>
                      </div>

                      {/* Time Display */}
                      <span className="text-sm font-mono" data-testid="time-display">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center space-x-3">
                      {/* Fullscreen */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFullscreen();
                        }}
                        className="hover:text-[var(--fluent-brand-primary)] transition-colors duration-200"
                        data-testid="button-fullscreen"
                      >
                        <FullScreenMaximizeRegular className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-6">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400/30 text-green-400 fluent-caption font-medium" data-testid="status-completed">
                    ✓ Đã tạo
                  </Badge>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <Button
                  size="sm"
                  variant="outlined"
                  onClick={handleDownload}
                  className="fluent-glass-subtle hover:fluent-glass border-[var(--fluent-neutral-stroke-1)] text-[var(--fluent-neutral-foreground-1)] hover:text-[var(--fluent-brand-primary)] transition-all duration-200"
                  data-testid="button-download"
                >
                  <ArrowDownloadRegular className="w-4 h-4 mr-2" />
                  Tải xuống
                </Button>
                {taskId && (
                  <Button
                    size="sm"
                    onClick={handleGet1080p}
                    className="bg-gradient-to-r from-[var(--fluent-brand-primary)] to-[var(--fluent-brand-secondary)] hover:from-[var(--fluent-brand-secondary)] hover:to-[var(--fluent-brand-primary)] text-white transition-all duration-300 fluent-shadow-soft"
                    data-testid="button-get-1080p"
                  >
                    Tải 1080P
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
