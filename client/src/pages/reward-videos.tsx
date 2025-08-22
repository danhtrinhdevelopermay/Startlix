import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import RewardVideoWatcher from '@/components/reward-video-watcher';
import { GiftRegular, PlayRegular, ClockRegular, CheckmarkCircleRegular } from '@fluentui/react-icons';

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

export default function RewardVideosPage() {
  const [selectedVideo, setSelectedVideo] = useState<RewardVideo | null>(null);

  // Fetch available reward videos
  const { data: rewardVideos = [], isLoading: videosLoading } = useQuery<RewardVideo[]>({
    queryKey: ['/api/reward-videos'],
  });

  // Fetch user's watch history
  const { data: watchHistory = [], isLoading: historyLoading } = useQuery<VideoWatchHistory[]>({
    queryKey: ['/api/my-watch-history'],
  });

  // Get watch status for a video
  const getWatchStatus = (videoId: string) => {
    const history = watchHistory.find(h => h.rewardVideoId === videoId);
    if (!history) return 'not_started';
    if (history.rewardClaimed) return 'claimed';
    if (history.isCompleted) return 'completed';
    return 'in_progress';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleWatchVideo = (video: RewardVideo) => {
    setSelectedVideo(video);
  };

  const handleRewardClaimed = (creditsEarned: number) => {
    console.log(`Claimed ${creditsEarned} credits!`);
  };

  const handleCloseWatcher = () => {
    setSelectedVideo(null);
  };

  if (selectedVideo) {
    return (
      <div className="container mx-auto py-8 px-4">
        <RewardVideoWatcher
          video={selectedVideo}
          onRewardClaimed={handleRewardClaimed}
          onClose={handleCloseWatcher}
        />
      </div>
    );
  }

  if (videosLoading || historyLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải video thưởng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center gap-3">
          <GiftRegular className="w-8 h-8 text-yellow-500" />
          Video Thưởng
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Xem video để kiếm thêm credits. Bạn phải xem hết video mới nhận được phần thưởng!
        </p>
      </div>

      {/* No videos available */}
      {rewardVideos.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <GiftRegular className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Chưa có video thưởng</h3>
            <p className="text-gray-600">Hiện tại chưa có video nào để xem và kiếm credits.</p>
          </CardContent>
        </Card>
      )}

      {/* Videos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rewardVideos.map((video) => {
          const watchStatus = getWatchStatus(video.id);
          const history = watchHistory.find(h => h.rewardVideoId === video.id);
          
          return (
            <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow" data-testid={`video-card-${video.id}`}>
              <div className="relative">
                {/* Thumbnail */}
                <div className="aspect-video bg-gray-200 dark:bg-gray-800 relative overflow-hidden">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PlayRegular className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Status Overlay */}
                  <div className="absolute top-2 right-2">
                    {watchStatus === 'claimed' && (
                      <Badge className="bg-green-500 text-white">
                        <CheckmarkCircleRegular className="w-3 h-3 mr-1" />
                        Đã nhận thưởng
                      </Badge>
                    )}
                    {watchStatus === 'completed' && (
                      <Badge className="bg-blue-500 text-white">
                        <GiftRegular className="w-3 h-3 mr-1" />
                        Có thể nhận thưởng
                      </Badge>
                    )}
                    {watchStatus === 'in_progress' && (
                      <Badge className="bg-yellow-500 text-white">
                        Đang xem ({Math.round((history!.watchedSeconds / video.duration) * 100)}%)
                      </Badge>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    <ClockRegular className="w-3 h-3 inline mr-1" />
                    {formatDuration(video.duration)}
                  </div>
                </div>

                <CardHeader>
                  <CardTitle className="text-lg line-clamp-2">{video.title}</CardTitle>
                  {video.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                      {video.description}
                    </p>
                  )}
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <GiftRegular className="w-4 h-4 text-yellow-500" />
                      <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                        {video.creditsReward} Credit
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleWatchVideo(video)}
                    disabled={watchStatus === 'claimed'}
                    className="w-full"
                    variant={watchStatus === 'claimed' ? 'secondary' : 'default'}
                    data-testid={`watch-button-${video.id}`}
                  >
                    {watchStatus === 'claimed' && (
                      <>
                        <CheckmarkCircleRegular className="w-4 h-4 mr-2" />
                        Đã hoàn thành
                      </>
                    )}
                    {watchStatus === 'completed' && (
                      <>
                        <GiftRegular className="w-4 h-4 mr-2" />
                        Nhận thưởng
                      </>
                    )}
                    {watchStatus === 'in_progress' && (
                      <>
                        <PlayRegular className="w-4 h-4 mr-2" />
                        Tiếp tục xem
                      </>
                    )}
                    {watchStatus === 'not_started' && (
                      <>
                        <PlayRegular className="w-4 h-4 mr-2" />
                        Bắt đầu xem
                      </>
                    )}
                  </Button>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}