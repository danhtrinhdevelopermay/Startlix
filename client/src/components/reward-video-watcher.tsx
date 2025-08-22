import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayRegular, PauseRegular, GiftRegular, CheckmarkCircleRegular } from '@fluentui/react-icons';
import { useToast } from '@/hooks/use-toast';

interface RewardVideo {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number;
  creditsReward: number;
  isActive: boolean;
  createdAt: string | null;
}

interface VideoWatchHistory {
  id: string;
  userId: string;
  rewardVideoId: string;
  watchedSeconds: number;
  isCompleted: boolean;
  rewardClaimed: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

interface RewardVideoWatcherProps {
  video: RewardVideo;
  onRewardClaimed?: (creditsEarned: number) => void;
  onClose?: () => void;
}

export default function RewardVideoWatcher({ video, onRewardClaimed, onClose }: RewardVideoWatcherProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [watchHistory, setWatchHistory] = useState<VideoWatchHistory | null>(null);
  const [canClaimReward, setCanClaimReward] = useState(false);
  const [hasAttemptedSkip, setHasAttemptedSkip] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Start watching mutation
  const startWatchingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/reward-videos/${video.id}/start-watching`);
      return await response.json();
    },
    onSuccess: (data: VideoWatchHistory) => {
      setWatchHistory(data);
      setCurrentTime(data.watchedSeconds);
      
      if (data.isCompleted && !data.rewardClaimed) {
        setCanClaimReward(true);
      }
    },
    onError: (error) => {
      console.error('Failed to start watching:', error);
      toast({
        title: "Lỗi",
        description: "Không thể bắt đầu xem video",
        variant: "destructive",
      });
    },
  });

  // Update progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async (watchedSeconds: number) => {
      const response = await apiRequest('POST', `/api/reward-videos/${video.id}/update-progress`, {
        watchedSeconds,
      });
      return await response.json();
    },
    onSuccess: (data: VideoWatchHistory) => {
      setWatchHistory(data);
      
      if (data.isCompleted && !data.rewardClaimed) {
        setCanClaimReward(true);
        toast({
          title: "Chúc mừng!",
          description: "Bạn đã xem hết video. Hãy nhận phần thưởng!",
        });
      }
    },
  });

  // Claim reward mutation
  const claimRewardMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/reward-videos/${video.id}/claim-reward`);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Nhận thưởng thành công!",
        description: `Bạn đã nhận được ${data.creditsEarned} credit. Tổng số credit: ${data.newCreditsBalance}`,
      });
      
      if (onRewardClaimed) {
        onRewardClaimed(data.creditsEarned);
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-watch-history'] });
      
      if (onClose) {
        onClose();
      }
    },
    onError: (error: any) => {
      console.error('Failed to claim reward:', error);
      toast({
        title: "Lỗi nhận thưởng",
        description: error.message || "Không thể nhận phần thưởng",
        variant: "destructive",
      });
    },
  });

  // Initialize watching when component mounts
  useEffect(() => {
    startWatchingMutation.mutate();
  }, []);

  // Handle video time updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const currentSeconds = Math.floor(video.currentTime);
      setCurrentTime(currentSeconds);
      
      // Update progress every 5 seconds to avoid too many API calls
      if (currentSeconds > 0 && currentSeconds % 5 === 0) {
        updateProgressMutation.mutate(currentSeconds);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleSeeking = () => {
      // Prevent skipping ahead
      if (video.currentTime > (watchHistory?.watchedSeconds || 0) + 5) {
        setHasAttemptedSkip(true);
        video.currentTime = watchHistory?.watchedSeconds || 0;
        toast({
          title: "Không được tua nhanh!",
          description: "Bạn phải xem hết video để nhận phần thưởng",
          variant: "destructive",
        });
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      const finalSeconds = Math.floor(video.duration);
      updateProgressMutation.mutate(finalSeconds);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('ended', handleEnded);
    };
  }, [watchHistory, updateProgressMutation]);

  const progressPercentage = video.duration > 0 ? (currentTime / video.duration) * 100 : 0;
  const completionThreshold = video.duration * 0.9;
  const isCompleted = currentTime >= completionThreshold;

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto" data-testid="reward-video-watcher">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{video.title}</span>
          <div className="flex items-center gap-2">
            <GiftRegular className="w-5 h-5 text-yellow-500" />
            <span className="text-yellow-500 font-semibold">{video.creditsReward} Credit</span>
          </div>
        </CardTitle>
        {video.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{video.description}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Video Player */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={video.videoUrl}
            className="w-full h-full"
            poster={video.thumbnailUrl || undefined}
            controls={false}
            data-testid="video-player"
          />
          
          {/* Custom Controls Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none">
            <div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
              <div className="flex items-center gap-4">
                <Button
                  onClick={handlePlayPause}
                  size="sm"
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30"
                  data-testid="play-pause-button"
                >
                  {isPlaying ? <PauseRegular className="w-4 h-4" /> : <PlayRegular className="w-4 h-4" />}
                </Button>
                
                <div className="flex-1 text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(video.duration)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Tiến độ xem video</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="text-xs text-gray-500">
            Cần xem ít nhất {Math.round((completionThreshold / video.duration) * 100)}% để nhận phần thưởng
          </div>
        </div>

        {/* Skip Warning */}
        {hasAttemptedSkip && (
          <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              ⚠️ Cảnh báo: Không được tua nhanh video! Bạn phải xem hết video để nhận phần thưởng.
            </p>
          </div>
        )}

        {/* Completion Status */}
        {isCompleted && canClaimReward && (
          <div className="bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4 text-center">
            <CheckmarkCircleRegular className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-green-800 dark:text-green-200 font-semibold mb-3">
              Chúc mừng! Bạn đã hoàn thành xem video!
            </p>
            <Button
              onClick={() => claimRewardMutation.mutate()}
              disabled={claimRewardMutation.isPending}
              className="bg-green-500 hover:bg-green-600"
              data-testid="claim-reward-button"
            >
              {claimRewardMutation.isPending ? 'Đang nhận...' : `Nhận ${video.creditsReward} Credit`}
            </Button>
          </div>
        )}

        {/* Already Claimed */}
        {watchHistory?.rewardClaimed && (
          <div className="bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4 text-center">
            <CheckmarkCircleRegular className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-blue-800 dark:text-blue-200 font-semibold">
              Bạn đã nhận phần thưởng cho video này rồi!
            </p>
          </div>
        )}

        {/* Close Button */}
        {onClose && (
          <div className="flex justify-center">
            <Button variant="outlined" onClick={onClose} data-testid="close-button">
              Đóng
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}