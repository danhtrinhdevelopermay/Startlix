import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import ErrorPopup from "@/components/error-popup";
import CreditBalance from "@/components/credit-balance";
import VideoPreview from "@/components/video-preview";
import GenerationHistory from "@/components/generation-history";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Upload, Sparkles, Image, FileText, LogOut, User, Monitor, Smartphone, Square, Zap, Trophy, X, Edit, Scissors } from "lucide-react";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import starlixLogo from "@assets/Dự án mới 32 [6F4A9A3]_1755821175424.png";
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { MD3VideoProcessingLoading } from "./md3-loading-indicator";

const textToVideoSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters").max(500, "Prompt must be less than 500 characters"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  model: z.enum(["veo3", "veo3_fast"]),
  watermark: z.string().optional(),
  hdGeneration: z.boolean().default(false),
});

const imageToVideoSchema = z.object({
  prompt: z.string().min(10, "Motion prompt must be at least 10 characters").max(500, "Motion prompt must be less than 500 characters"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  model: z.enum(["veo3", "veo3_fast"]),
  imageUrl: z.string().min(1, "Please upload an image"),
});

type TextToVideoForm = z.infer<typeof textToVideoSchema>;
type ImageToVideoForm = z.infer<typeof imageToVideoSchema>;

// Aspect ratio options with visual elements
const aspectRatioOptions = [
  {
    value: "16:9",
    label: "Ngang",
    description: "Định dạng rộng, hoàn hảo cho xem trên máy tính và YouTube",
    icon: Monitor,
    preview: "████████████",
    dimensions: "1920 × 1080"
  },
  {
    value: "9:16", 
    label: "Dọc",
    description: "Định dạng dọc, lý tưởng cho xem trên điện thoại và TikTok",
    icon: Smartphone,
    preview: "████\n████\n████",
    dimensions: "1080 × 1920"
  },
  {
    value: "1:1",
    label: "Vuông", 
    description: "Định dạng vuông hoàn hảo cho Instagram và mạng xã hội",
    icon: Square,
    preview: "████████\n████████",
    dimensions: "1080 × 1080"
  }
];

// Model options with visual elements
const modelOptions = [
  {
    value: "veo3",
    label: "Veo3 Cao cấp",
    description: "Tạo video AI chất lượng cao nhất với chi tiết vượt trội và chân thực",
    icon: Trophy,
    badge: "Chất lượng tốt nhất",
    features: ["Độ phân giải 4K", "AI tiên tiến", "Chuyển động chân thực"],
    credits: 5
  },
  {
    value: "veo3_fast",
    label: "Veo3 Nhanh",
    description: "Tạo nhanh với chất lượng tốt, hoàn hảo cho nguyên mẫu nhanh",
    icon: Zap,
    badge: "Tạo nhanh",
    features: ["Độ phân giải HD", "Xử lý nhanh", "Chất lượng tốt"],
    credits: 3
  }
];

export default function VideoGenerator() {
  const { user } = useAuth();
  const logoutMutation = useLogout();
  const [activeTab, setActiveTab] = useState<"text-to-video" | "image-to-video">("text-to-video");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [aspectRatioModalOpen, setAspectRatioModalOpen] = useState(false);
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [currentFormType, setCurrentFormType] = useState<"text" | "image">("text");
  const [uploadedImageName, setUploadedImageName] = useState<string>("");
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>("");
  const [currentTaskId, setCurrentTaskId] = useState<string>("");
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState<boolean>(false);
  const [loadingStartTime, setLoadingStartTime] = useState<Date | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  // Image cropping states
  const [showCropper, setShowCropper] = useState<boolean>(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [originalImageUrl, setOriginalImageUrl] = useState<string>("");
  const [croppedImageUrl, setCroppedImageUrl] = useState<string>("");
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast({
        title: "Đăng xuất thành công",
        description: "Bạn đã đăng xuất khỏi tài khoản",
      });
    } catch (error) {
      toast({
        title: "Lỗi đăng xuất",
        description: "Không thể đăng xuất. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  // Progress tracking for loading modal
  useEffect(() => {
    if (!loadingStartTime || !isLoadingModalOpen) return;

    const interval = setInterval(() => {
      const elapsedSeconds = (new Date().getTime() - loadingStartTime.getTime()) / 1000;
      // Estimate 300 seconds (5 minutes) for completion - VEO3 can take longer
      const estimatedDuration = 300;
      const calculatedProgress = Math.min((elapsedSeconds / estimatedDuration) * 85, 85); // Cap at 85% until actual completion
      setLoadingProgress(calculatedProgress);
    }, 1000);

    return () => clearInterval(interval);
  }, [loadingStartTime, isLoadingModalOpen]);

  // Monitor video status to close modal when complete
  const { data: videoStatus } = useQuery<any>({
    queryKey: ["/api/video-status", currentTaskId],
    enabled: !!currentTaskId && isLoadingModalOpen,
    refetchInterval: (data) => {
      if ((data as any)?.successFlag === 1 || (data as any)?.successFlag === -1) {
        return false;
      }
      return 5000; // Poll every 5 seconds
    },
  });

  useEffect(() => {
    if (videoStatus?.successFlag === 1 && videoStatus?.response?.resultUrls?.[0]) {
      setLoadingProgress(100);
      setIsLoadingModalOpen(false);
      setCurrentVideoUrl(videoStatus.response.resultUrls[0]);
      toast({
        title: "Tạo video thành công!",
        description: "Video của bạn đã sẵn sàng để xem trước.",
      });
    } else if (videoStatus?.successFlag === -1) {
      setIsLoadingModalOpen(false);
      showPopup(
        "Tạo video thất bại", 
        videoStatus?.errorMessage || "Có lỗi xảy ra trong quá trình tạo video. Vui lòng thử lại.", 
        "error"
      );
    } else if (videoStatus?.status === "processing") {
      const elapsedSeconds = loadingStartTime ? (new Date().getTime() - loadingStartTime.getTime()) / 1000 : 0;
      
      // Timeout after 8 minutes for veo3_fast, 12 minutes for veo3
      const timeoutSeconds = 480; // 8 minutes for veo3_fast, could extend to 720 for veo3
      
      if (elapsedSeconds > timeoutSeconds) {
        setIsLoadingModalOpen(false);
        showPopup(
          "Timeout - Video quá lâu", 
          "Video đã vượt quá thời gian xử lý bình thường. Có thể VEO3 đang quá tải. Vui lòng thử tạo video mới với prompt ngắn gọn hơn.", 
          "warning"
        );
      } else if (elapsedSeconds > 180) { // 3 minutes
        const remainingMinutes = Math.ceil((timeoutSeconds - elapsedSeconds) / 60);
        toast({
          title: "Video đang được xử lý",
          description: `VEO3 đang tạo video phức tạp. Còn tối đa ${remainingMinutes} phút nữa.`,
        });
      }
    }
  }, [videoStatus, toast, loadingStartTime, currentTaskId]);

  const showPopup = (title: string, description: string, type: "error" | "warning" | "info" = "error") => {
    setPopup({ isOpen: true, title, description, type });
  };

  const closePopup = () => {
    setPopup({ isOpen: false, title: "", description: "", type: "error" });
  };

  const textForm = useForm<TextToVideoForm>({
    resolver: zodResolver(textToVideoSchema),
    defaultValues: {
      prompt: "",
      aspectRatio: "16:9",
      model: "veo3",
      watermark: "",
      hdGeneration: false,
    },
  });

  const imageForm = useForm<ImageToVideoForm>({
    resolver: zodResolver(imageToVideoSchema),
    defaultValues: {
      prompt: "",
      aspectRatio: "16:9",
      model: "veo3",
      imageUrl: "",
    },
  });

  // Helper function to create image from URL
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error: Event) => reject(error));
      image.src = url;
    });

  // Helper function to get cropped image
  const getCroppedImg = useCallback(
    async (imageSrc: string, pixelCrop: PixelCrop): Promise<string> => {
      const image = await createImage(imageSrc);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('No 2d context');
      }

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      return new Promise((resolve) => {
        canvas.toBlob((file) => {
          if (file) {
            resolve(URL.createObjectURL(file));
          }
        }, 'image/jpeg');
      });
    },
    []
  );

  // Handle image load for cropper
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        1,
        width,
        height
      ),
      width,
      height
    ));
  }, []);

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiRequest("POST", "/api/upload-image", formData);
      return await response.json();
    },
    onSuccess: (data) => {
      setOriginalImageUrl(data.downloadUrl);
      setUploadedImageUrl(data.downloadUrl);
      imageForm.setValue("imageUrl", data.downloadUrl);
      toast({
        title: "Tải ảnh thành công",
        description: "Ảnh của bạn đã sẵn sàng để tạo video.",
      });
    },
    onError: (error) => {
      let title = "Tải ảnh thất bại";
      let description = "Không thể tải ảnh lên";

      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('500') || errorMessage.includes('server') || errorMessage.includes('overload')) {
          title = "Máy chủ quá tải";
          description = "Máy chủ đang xử lý quá nhiều yêu cầu. Vui lòng thử lại sau vài phút.";
        }
        else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          title = "Lỗi kết nối";
          description = "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối internet.";
        }
        else if (errorMessage.includes('size') || errorMessage.includes('large')) {
          title = "File quá lớn";
          description = "Ảnh của bạn quá lớn. Vui lòng chọn ảnh nhỏ hơn 10MB.";
        }
        else {
          description = "Đã xảy ra lỗi khi tải ảnh. Vui lòng thử lại.";
        }
      }

      showPopup(title, description, "error");
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/generate-video", data);
      return await response.json();
    },
    onSuccess: (data) => {
      setCurrentTaskId(data.taskId);
      setIsLoadingModalOpen(true);
      setLoadingStartTime(new Date());
      setLoadingProgress(0);
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      toast({
        title: "Bắt đầu tạo video",
        description: `Đang tạo video với ID: ${data.taskId}`,
      });
    },
    onError: (error) => {
      let title = "Tạo video thất bại";
      let description = "Có lỗi xảy ra khi tạo video";

      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Check for server overload/500 errors
        if (errorMessage.includes('500') || errorMessage.includes('server') || errorMessage.includes('overload')) {
          title = "Máy chủ quá tải";
          description = "Máy chủ đang xử lý quá nhiều yêu cầu. Vui lòng thử lại sau vài phút.";
        }
        // Check for insufficient credits  
        else if (errorMessage.includes('insufficient') || errorMessage.includes('credits') || errorMessage.includes('top up')) {
          title = "Không đủ credits";
          description = "Tài khoản của bạn không đủ credits. Vui lòng nạp thêm để tiếp tục.";
        }
        // Check for network/connection issues
        else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
          title = "Lỗi kết nối";
          description = "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối internet và thử lại.";
        }
        // Other errors
        else {
          description = "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.";
        }
      }

      setIsLoadingModalOpen(false);
      showPopup(title, description, "error");
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        showPopup("Định dạng file không hợp lệ", "Vui lòng tải lên file ảnh (PNG, JPG, GIF)", "error");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showPopup("File quá lớn", "Vui lòng tải lên ảnh nhỏ hơn 10MB", "error");
        return;
      }
      setUploadedImageName(file.name);
      uploadImageMutation.mutate(file);
    }
    // Reset input value to allow re-uploading the same file
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleRemoveImage = () => {
    setUploadedImageUrl("");
    setOriginalImageUrl("");
    setCroppedImageUrl("");
    setUploadedImageName("");
    imageForm.setValue("imageUrl", "");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleChangeImage = () => {
    fileInputRef.current?.click();
  };

  const handleCropImage = () => {
    setShowCropper(true);
  };

  const handleCropComplete = async () => {
    if (completedCrop && originalImageUrl) {
      try {
        const croppedImage = await getCroppedImg(originalImageUrl, completedCrop);
        setCroppedImageUrl(croppedImage);
        setUploadedImageUrl(croppedImage);
        imageForm.setValue("imageUrl", croppedImage);
        setShowCropper(false);
        toast({
          title: "Cắt ảnh thành công",
          description: "Ảnh đã được cắt theo ý muốn của bạn.",
        });
      } catch (error) {
        showPopup("Lỗi cắt ảnh", "Không thể cắt ảnh. Vui lòng thử lại.", "error");
      }
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const onTextToVideoSubmit = (data: TextToVideoForm) => {
    generateVideoMutation.mutate({
      ...data,
      type: "text-to-video",
      userId: user?.id || "",
    });
  };

  const onImageToVideoSubmit = (data: ImageToVideoForm) => {
    generateVideoMutation.mutate({
      ...data,
      type: "image-to-video",
      userId: user?.id || "",
    });
  };

  return (
    <div>
      {/* Header - Material Design 3 Top App Bar */}
      <header className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo Section */}
            <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
              <img src={starlixLogo} alt="Starlix Logo" className="h-8 sm:h-10 w-auto" />
              <h1 className="md-typescale-title-large text-[var(--md-sys-color-primary)]">
                Starlix
              </h1>
            </div>
            
            {/* Navigation Actions */}
            <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3 flex-shrink-0">
              {/* User Info */}
              <div className="hidden sm:flex items-center space-x-2 mr-1 md:mr-2">
                <User className="w-4 h-4 text-[var(--md-sys-color-primary)]" />
                <span className="md-typescale-body-medium text-[var(--md-sys-color-on-surface)] truncate max-w-[100px]">
                  {user?.username}
                </span>
              </div>
              
              {/* Credit Balance */}
              <CreditBalance />
              
              {/* Video Thưởng Button */}
              <Link href="/reward-videos">
                <Button 
                  variant="outlined"
                  size="sm"
                  className="hidden sm:flex"
                  data-testid="nav-reward-videos"
                >
                  <Trophy className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden md:inline">Video Thưởng</span>
                </Button>
              </Link>
              
              {/* Mobile Video Thưởng Button */}
              <Link href="/reward-videos" className="sm:hidden">
                <Button 
                  variant="text"
                  size="sm"
                  data-testid="nav-reward-videos-mobile"
                >
                  <Trophy className="w-4 h-4" />
                </Button>
              </Link>
              
              {/* Logout Button */}
              <Button 
                variant="text"
                size="sm"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                data-testid="button-logout"
                className="flex-shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Generation Controls */}
          <div className="lg:col-span-2">
            <div className="bg-[var(--md-sys-color-surface-container-low)] rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] overflow-hidden shadow-sm">
              {/* Tab Navigation - Material Design 3 Secondary Navigation */}
              <div className="flex border-b border-[var(--md-sys-color-outline-variant)]">
                <button
                  className={`flex-1 px-6 py-4 border-b-2 transition-all duration-200 md-typescale-title-small ${
                    activeTab === "text-to-video"
                      ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] border-[var(--md-sys-color-primary)]"
                      : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-variant)] border-transparent"
                  }`}
                  onClick={() => setActiveTab("text-to-video")}
                  data-testid="tab-text-to-video"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Text to Video</span>
                  </div>
                </button>
                <button
                  className={`flex-1 px-6 py-4 border-b-2 transition-all duration-200 md-typescale-title-small ${
                    activeTab === "image-to-video"
                      ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] border-[var(--md-sys-color-primary)]"
                      : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-variant)] border-transparent"
                  }`}
                  onClick={() => setActiveTab("image-to-video")}
                  data-testid="tab-image-to-video"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Image className="w-5 h-5" />
                    <span>Image to Video</span>
                  </div>
                </button>
              </div>

              {/* Text to Video Panel */}
              {activeTab === "text-to-video" && (
                <div className="p-6">
                  <Form {...textForm}>
                    <form onSubmit={textForm.handleSubmit(onTextToVideoSubmit)} className="space-y-6">
                      <FormField
                        control={textForm.control}
                        name="prompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300 mb-4 block">Video Prompt</FormLabel>
                            <FormControl>
                              <div className="premium-input-container">
                                <div className="premium-input-wrapper">
                                  <textarea
                                    placeholder="Describe your video... (e.g., 'A golden retriever playing fetch in a sunny park, slow motion, cinematic lighting')"
                                    className="premium-textarea"
                                    data-testid="input-text-prompt"
                                    {...field}
                                  />
                                </div>
                              </div>
                            </FormControl>
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>Be specific about lighting, camera angles, and style</span>
                              <span data-testid="text-prompt-length">{field.value.length}/500</span>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={textForm.control}
                          name="aspectRatio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="md-typescale-body-large text-[var(--md-sys-color-on-surface)] mb-2 block">Aspect Ratio</FormLabel>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outlined"
                                  className="w-full justify-between h-14"
                                  onClick={() => {
                                    setCurrentFormType("text");
                                    setAspectRatioModalOpen(true);
                                  }}
                                  data-testid="button-select-aspect-ratio"
                                >
                                  <span className="md-typescale-body-large">
                                    {field.value ? aspectRatioOptions.find(opt => opt.value === field.value)?.label : "Choose aspect ratio"}
                                  </span>
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={textForm.control}
                          name="model"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="md-typescale-body-large text-[var(--md-sys-color-on-surface)] mb-2 block">Model</FormLabel>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outlined"
                                  className="w-full justify-between h-14"
                                  onClick={() => {
                                    setCurrentFormType("text");
                                    setModelModalOpen(true);
                                  }}
                                  data-testid="button-select-model"
                                >
                                  <span className="md-typescale-body-large">
                                    {field.value ? modelOptions.find(opt => opt.value === field.value)?.label : "Choose model"}
                                  </span>
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white transition-colors">
                          Advanced Options
                          <ChevronDown className="w-5 h-5 transform transition-transform data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-4 space-y-4 pl-4">
                          <FormField
                            control={textForm.control}
                            name="watermark"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-300 mb-4 block">Watermark (Optional)</FormLabel>
                                <FormControl>
                                  <div className="premium-input-container">
                                    <div className="premium-input-wrapper">
                                      <input
                                        placeholder="Your brand name"
                                        className="premium-input"
                                        data-testid="input-watermark"
                                        {...field}
                                      />
                                    </div>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={textForm.control}
                            name="hdGeneration"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-highest)]">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="mt-1"
                                    data-testid="checkbox-hd-generation"
                                  />
                                </FormControl>
                                <FormLabel className="md-typescale-body-medium text-[var(--md-sys-color-on-surface)] cursor-pointer">
                                  Generate 1080P HD version (+2 credits)
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        </CollapsibleContent>
                      </Collapsible>

                      <Button
                        type="submit"
                        disabled={generateVideoMutation.isPending}
                        className="w-full h-14 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:shadow-lg hover:shadow-[var(--md-sys-color-primary)]/25 md-typescale-label-large"
                        data-testid="button-generate-text-video"
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        <span>
                          {generateVideoMutation.isPending ? "Generating..." : "Generate Video"}
                        </span>
                        <span className="ml-2 px-2 py-1 bg-[var(--md-sys-color-on-primary)]/20 rounded-full md-typescale-label-small">
                          5 credits
                        </span>
                      </Button>
                    </form>
                  </Form>
                </div>
              )}

              {/* Image to Video Panel */}
              {activeTab === "image-to-video" && (
                <div className="p-6">
                  <Form {...imageForm}>
                    <form onSubmit={imageForm.handleSubmit(onImageToVideoSubmit)} className="space-y-6">
                      <FormField
                        control={imageForm.control}
                        name="imageUrl"
                        render={() => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Upload Image</FormLabel>
                            <FormControl>
                              {!uploadedImageUrl ? (
                                <div 
                                  className="border-2 border-dashed border-dark-500 rounded-lg p-8 text-center hover:border-primary-500 transition-colors cursor-pointer bg-dark-600/50"
                                  onClick={() => fileInputRef.current?.click()}
                                  data-testid="upload-area"
                                >
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    data-testid="input-file-upload"
                                  />
                                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                  <div className="text-sm text-gray-400">
                                    <span className="text-primary-400 font-medium">Click to upload</span> or drag and drop
                                  </div>
                                  <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF up to 10MB</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {/* Image Preview */}
                                  <div className="relative rounded-lg overflow-hidden bg-dark-600">
                                    <img 
                                      src={uploadedImageUrl} 
                                      alt="Uploaded preview" 
                                      className="w-full h-48 object-cover"
                                      data-testid="image-preview"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                    <div className="absolute bottom-2 left-2 right-2">
                                      <p className="text-sm text-white font-medium truncate">{uploadedImageName}</p>
                                    </div>
                                  </div>
                                  
                                  {/* Action Buttons */}
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="outlined"
                                      size="sm"
                                      onClick={handleChangeImage}
                                      className="bg-dark-600 border-dark-500 text-gray-300 hover:bg-dark-500"
                                      data-testid="button-change-image"
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Thay đổi ảnh
                                    </Button>
                                    
                                    <Button
                                      type="button"
                                      variant="outlined"
                                      size="sm"
                                      onClick={handleCropImage}
                                      className="bg-dark-600 border-dark-500 text-gray-300 hover:bg-dark-500"
                                      data-testid="button-crop-image"
                                    >
                                      <Scissors className="w-4 h-4 mr-2" />
                                      Cắt ảnh
                                    </Button>
                                    
                                    <Button
                                      type="button"
                                      variant="outlined"
                                      size="sm"
                                      onClick={handleRemoveImage}
                                      className="bg-red-600/20 border-red-500 text-red-400 hover:bg-red-600/30"
                                      data-testid="button-remove-image"
                                    >
                                      <X className="w-4 h-4 mr-2" />
                                      Hủy ảnh
                                    </Button>
                                  </div>
                                  
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    data-testid="input-file-upload"
                                  />
                                </div>
                              )}
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={imageForm.control}
                        name="prompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300 mb-4 block">Motion Prompt</FormLabel>
                            <FormControl>
                              <div className="premium-input-container">
                                <div className="premium-input-wrapper">
                                  <textarea
                                    placeholder="Describe how the image should animate... (e.g., 'The person starts walking forward with confident steps')"
                                    className="premium-textarea"
                                    style={{minHeight: '100px'}}
                                    data-testid="input-motion-prompt"
                                    {...field}
                                  />
                                </div>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={imageForm.control}
                          name="aspectRatio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Aspect Ratio</FormLabel>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outlined"
                                  className="w-full justify-between bg-dark-600 border-dark-500 text-white hover:bg-dark-500"
                                  onClick={() => {
                                    setCurrentFormType("image");
                                    setAspectRatioModalOpen(true);
                                  }}
                                  data-testid="button-select-image-aspect-ratio"
                                >
                                  {field.value ? aspectRatioOptions.find(opt => opt.value === field.value)?.label : "Choose aspect ratio"}
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={imageForm.control}
                          name="model"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Model</FormLabel>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outlined"
                                  className="w-full justify-between bg-dark-600 border-dark-500 text-white hover:bg-dark-500"
                                  onClick={() => {
                                    setCurrentFormType("image");
                                    setModelModalOpen(true);
                                  }}
                                  data-testid="button-select-image-model"
                                >
                                  {field.value ? modelOptions.find(opt => opt.value === field.value)?.label : "Choose model"}
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={generateVideoMutation.isPending || !uploadedImageUrl}
                        className="premium-gen-button w-full"
                        data-testid="button-generate-image-video"
                      >
                        <div className="wrap">
                          <div className="content">
                            <span className="star">✧</span>
                            <span className="star">✦</span>
                            <Image className="w-5 h-5" />
                            <span>
                              {generateVideoMutation.isPending ? "Animating..." : "Animate Image"}
                            </span>
                            <span className="text-xs bg-black/30 px-2 py-1 rounded-full">7 credits</span>
                          </div>
                        </div>
                      </button>
                    </form>
                  </Form>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Video Preview & History */}
          <div className="space-y-6">
            <VideoPreview 
              videoUrl={currentVideoUrl} 
              taskId={currentTaskId} 
              onVideoLoad={setCurrentVideoUrl}
            />
            <GenerationHistory onSelectVideo={setCurrentVideoUrl} />
          </div>
        </div>

        {/* Feature Showcase */}
        <div className="mt-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Powered by Veo3 AI
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Generate stunning, high-quality videos from text prompts or animate your images with state-of-the-art AI technology.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-dark-700 rounded-xl p-6 border border-dark-600 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
              <p className="text-gray-400 text-sm">Generate videos in minutes with our optimized Veo3 API integration</p>
            </div>
            
            <div className="bg-dark-700 rounded-xl p-6 border border-dark-600 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">High Quality</h3>
              <p className="text-gray-400 text-sm">Professional-grade 1080P video generation with cinematic quality</p>
            </div>
            
            <div className="bg-dark-700 rounded-xl p-6 border border-dark-600 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Easy to Use</h3>
              <p className="text-gray-400 text-sm">Intuitive interface designed for creators of all skill levels</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-600 bg-dark-700 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <span className="text-sm text-gray-400">
                Powered by{" "}
                <a 
                  href="https://veo3api.ai" 
                  className="text-primary-400 hover:text-primary-300 transition-colors"
                  data-testid="link-veo3api"
                >
                  Veo3 API
                </a>
              </span>
            </div>
            
            <div className="flex space-x-6 text-sm text-gray-400">
              <a 
                href="https://docs.veo3api.ai" 
                className="hover:text-white transition-colors"
                data-testid="link-documentation"
              >
                Documentation
              </a>
              <a 
                href="https://veo3api.ai/api-key" 
                className="hover:text-white transition-colors"
                data-testid="link-api-key"
              >
                Get API Key
              </a>
              <a 
                href="#" 
                className="hover:text-white transition-colors"
                data-testid="link-support"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Loading Modal */}
      <Dialog open={isLoadingModalOpen} onOpenChange={(open) => !open && setIsLoadingModalOpen(false)}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogContent className="fixed inset-0 z-50 bg-dark-900/90 backdrop-blur-2xl border-0 p-0 shadow-none duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 px-8">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Xem trước</h1>
              </div>
              
              {/* Loading Container */}
              <div className="bg-[var(--md-sys-color-surface-container)] backdrop-blur-md rounded-[var(--md-sys-shape-corner-extra-large)] p-8 md:p-12 border border-[var(--md-sys-color-outline-variant)] max-w-2xl w-full shadow-md">
                <div className="mb-8">
                  <MD3VideoProcessingLoading 
                    progress={loadingProgress / 100}
                    data-testid="loading-video-processing"
                  />
                </div>
                
                <h2 className="text-xl md:text-2xl font-semibold text-gray-300 mb-8">Đang tạo video của bạn...</h2>
                
                <div className="mb-6">
                  <Progress 
                    value={loadingProgress} 
                    className="h-3 md:h-4 bg-[var(--md-sys-color-surface-container-low)]"
                    data-testid="modal-progress-bar"
                  />
                </div>
                
                <div className="flex justify-between items-center text-sm md:text-base text-gray-400">
                  <span data-testid="modal-progress-percentage" className="font-medium">{Math.round(loadingProgress)}%</span>
                  <span>~{Math.max(0, 120 - Math.round((new Date().getTime() - (loadingStartTime?.getTime() || 0)) / 1000))}s còn lại</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Aspect Ratio Selection Modal */}
      <Dialog open={aspectRatioModalOpen} onOpenChange={setAspectRatioModalOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/50 z-50" />
          <DialogContent className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-[var(--md-sys-shape-corner-large)] p-4 w-[95vw] max-w-sm max-h-[85vh] overflow-y-auto z-50 shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[var(--md-sys-color-on-surface)] mb-4">Chọn Tỷ lệ khung hình</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {aspectRatioOptions.map((option) => {
                const IconComponent = option.icon;
                const currentValue = currentFormType === "text" 
                  ? textForm.getValues().aspectRatio 
                  : imageForm.getValues().aspectRatio;
                const isSelected = currentValue === option.value;
                
                return (
                  <button
                    key={option.value}
                    className={`w-full p-3 rounded-lg border transition-all ${
                      isSelected 
                        ? 'border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]' 
                        : 'border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface)] hover:border-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-high)]'
                    }`}
                    onClick={() => {
                      if (currentFormType === "text") {
                        textForm.setValue("aspectRatio", option.value as "16:9" | "9:16" | "1:1");
                      } else {
                        imageForm.setValue("aspectRatio", option.value as "16:9" | "9:16" | "1:1");
                      }
                      setAspectRatioModalOpen(false);
                    }}
                    data-testid={`option-aspect-ratio-${option.value}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <IconComponent className="w-6 h-6 text-primary-400" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-sm truncate">{option.label}</h3>
                          <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{option.dimensions}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-tight">{option.description}</p>
                        <div className="mt-1 text-xs font-mono text-primary-300">
                          {option.value}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Model Selection Modal */}
      <Dialog open={modelModalOpen} onOpenChange={setModelModalOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/50 z-50" />
          <DialogContent className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-dark-700 border border-dark-600 rounded-xl p-4 w-[95vw] max-w-sm max-h-[85vh] overflow-y-auto z-50">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white mb-4">Chọn Mô hình AI</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {modelOptions.map((option) => {
                const IconComponent = option.icon;
                const currentValue = currentFormType === "text" 
                  ? textForm.getValues().model 
                  : imageForm.getValues().model;
                const isSelected = currentValue === option.value;
                
                return (
                  <button
                    key={option.value}
                    className={`w-full p-3 rounded-lg border transition-all ${
                      isSelected 
                        ? 'border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]' 
                        : 'border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface)] hover:border-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-high)]'
                    }`}
                    onClick={() => {
                      if (currentFormType === "text") {
                        textForm.setValue("model", option.value as "veo3" | "veo3_fast");
                      } else {
                        imageForm.setValue("model", option.value as "veo3" | "veo3_fast");
                      }
                      setModelModalOpen(false);
                    }}
                    data-testid={`option-model-${option.value}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <IconComponent className="w-6 h-6 text-primary-400" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-start justify-between mb-1 gap-2">
                          <h3 className="font-semibold text-sm truncate">{option.label}</h3>
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            <span className="text-xs bg-primary-600 px-1.5 py-0.5 rounded-full">{option.badge}</span>
                            <span className="text-xs text-primary-400">{option.credits}c</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 leading-tight mb-2">{option.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {option.features.map((feature, index) => (
                            <span 
                              key={index}
                              className="text-xs bg-dark-500 px-1.5 py-0.5 rounded text-gray-300"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Image Crop Modal */}
      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/80 z-50" />
          <DialogContent className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-dark-800 border border-dark-600 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto z-50">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold mb-4">Cắt ảnh</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {originalImageUrl && (
                <div className="flex justify-center">
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={1}
                    className="max-w-full"
                  >
                    <img
                      ref={imgRef}
                      alt="Crop me"
                      src={originalImageUrl}
                      style={{ transform: `scale(1) rotate(0deg)` }}
                      onLoad={onImageLoad}
                      className="max-h-96 max-w-full object-contain"
                    />
                  </ReactCrop>
                </div>
              )}
              
              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outlined"
                  onClick={handleCropCancel}
                  className="bg-dark-600 border-dark-500 text-gray-300 hover:bg-dark-500"
                  data-testid="button-crop-cancel"
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  onClick={handleCropComplete}
                  disabled={!completedCrop}
                  className="bg-primary-600 hover:bg-primary-700 text-white"
                  data-testid="button-crop-complete"
                >
                  Áp dụng cắt ảnh
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

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
