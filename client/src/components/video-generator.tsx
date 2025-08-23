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
import { ChevronDown, Upload, Sparkles, Image, FileText, LogOut, User, Monitor, Smartphone, Square, Zap, Trophy, X, Edit, Scissors, Link2, Wand2 } from "lucide-react";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import logoUrl from "@/assets/logo.png";
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { MD3VideoProcessingLoading } from "./md3-loading-indicator";

const textToVideoSchema = z.object({
  prompt: z.string().min(10, "Prompt phải có ít nhất 10 ký tự").max(500, "Prompt phải có ít hơn 500 ký tự"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  model: z.enum(["veo3", "veo3_fast"]),
  watermark: z.string().optional(),
  hdGeneration: z.boolean().default(false),
});

const imageToVideoSchema = z.object({
  prompt: z.string().min(10, "Prompt chuyển động phải có ít nhất 10 ký tự").max(500, "Prompt chuyển động phải có ít hơn 500 ký tự"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  model: z.enum(["veo3", "veo3_fast"]),
  imageUrl: z.string().min(1, "Vui lòng tải lên một ảnh"),
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
    label: "STLix Cao cấp",
    description: "Tạo video AI chất lượng cao nhất với chi tiết vượt trội và tự động nâng cao chất lượng",
    icon: Trophy,
    badge: "Chất lượng tốt nhất",
    features: ["Độ phân giải 4K", "AI tiên tiến", "Tự động nâng cao chất lượng"],
    credits: 5
  },
  {
    value: "veo3_fast",
    label: "STLix Nhanh",
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
  // Prompt expansion states
  const [isExpandingPrompt, setIsExpandingPrompt] = useState<boolean>(false);
  const [expandingPromptType, setExpandingPromptType] = useState<'text' | 'image' | null>(null);
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

  // Form declarations
  const textForm = useForm<TextToVideoForm>({
    resolver: zodResolver(textToVideoSchema),
    defaultValues: {
      prompt: "",
      aspectRatio: "16:9",
      model: "veo3_fast",
      watermark: "",
      hdGeneration: false,
    },
  });

  const imageForm = useForm<ImageToVideoForm>({
    resolver: zodResolver(imageToVideoSchema),
    defaultValues: {
      prompt: "",
      aspectRatio: "16:9",
      model: "veo3_fast",
      imageUrl: "",
    },
  });

  
  const { toast } = useToast();
  const queryClient = useQueryClient();








  // Check STLIX Premium model status
  const { data: veo3PremiumStatus } = useQuery({
    queryKey: ["/api/model-status/veo3-premium"],
    refetchInterval: 10000, // Check every 10 seconds
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache the result (updated from cacheTime)
  });


  // Test connection to WebSocket service
  const testConnection = async () => {
    return new Promise((resolve) => {
      const testSocket = new WebSocket("wss://backend.buildpicoapps.com/api/chatbot/chat");
      let connected = false;
      
      testSocket.addEventListener("open", () => {
        connected = true;
        testSocket.close();
        resolve(true);
      });
      
      testSocket.addEventListener("error", () => {
        resolve(false);
      });
      
      setTimeout(() => {
        if (!connected) {
          testSocket.close();
          resolve(false);
        }
      }, 5000);
    });
  };

  // Prompt expansion function with WebSocket
  const expandPrompt = async (currentPrompt: string, promptType: 'text' | 'image') => {
    if (!currentPrompt.trim() || isExpandingPrompt) return;
    
    setIsExpandingPrompt(true);
    setExpandingPromptType(promptType);
    
    console.log('Starting prompt expansion for:', currentPrompt);
    
    // Test connection first
    const canConnect = await testConnection();
    if (!canConnect) {
      console.log('Cannot connect to WebSocket service');
      setIsExpandingPrompt(false);
      setExpandingPromptType(null);
      toast({
        title: "Lỗi kết nối",
        description: "Không thể kết nối đến dịch vụ AI. Dịch vụ có thể đang bảo trì.",
        variant: "destructive",
      });
      return;
    }
    
    let receiving = true;
    const url = "wss://backend.buildpicoapps.com/api/chatbot/chat";
    const websocket = new WebSocket(url);
    
    const chatId = Date.now().toString();
    const systemPrompt = `Bạn là một AI assistant chuyên viết lại prompt tạo video để chi tiết và đầy đủ hơn. Hãy viết lại prompt sau đây để:
- Thêm chi tiết về góc quay, ánh sáng, phong cách
- Mô tả cảnh quan, bối cảnh rõ ràng hơn
- Thêm thông tin về chuyển động, cảm xúc
- Giữ nguyên ý nghĩa gốc nhưng làm cho sinh động và chuyên nghiệp hơn
- Chỉ trả về prompt đã được mở rộng, không thêm giải thích`;

    let expandedPrompt = "";
    let timeoutId: NodeJS.Timeout;

    websocket.addEventListener("open", () => {
      console.log('WebSocket connected successfully');
      const messagePayload = {
        chatId: chatId,
        appId: "for-few",
        systemPrompt: systemPrompt,
        message: `Viết lại prompt này chi tiết hơn: "${currentPrompt}"`
      };
      console.log('Sending message:', messagePayload);
      websocket.send(JSON.stringify(messagePayload));
      
      // Set timeout for response
      timeoutId = setTimeout(() => {
        if (receiving) {
          console.log('WebSocket timeout - no response received');
          websocket.close();
          setIsExpandingPrompt(false);
          setExpandingPromptType(null);
          toast({
            title: "Timeout",
            description: "Quá thời gian chờ phản hồi. Dịch vụ có thể đang bận.",
            variant: "destructive",
          });
        }
      }, 15000); // Reduced timeout to 15 seconds
    });
    
    websocket.addEventListener("message", (event) => {
      try {
        console.log('Received message:', event.data);
        const data = JSON.parse(event.data);
        
        // Handle different possible response formats
        if (data.message) {
          expandedPrompt += data.message;
        } else if (data.content) {
          expandedPrompt += data.content;
        } else if (data.text) {
          expandedPrompt += data.text;
        } else if (typeof data === 'string') {
          expandedPrompt += data;
        }
        
        console.log('Current expandedPrompt:', expandedPrompt);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        // Try to handle as plain text
        if (typeof event.data === 'string') {
          expandedPrompt += event.data;
        }
      }
    });

    websocket.addEventListener("close", () => {
      receiving = false;
      if (timeoutId) clearTimeout(timeoutId);
      
      console.log('WebSocket closed, expandedPrompt:', expandedPrompt);
      
      if (expandedPrompt.trim()) {
        // Clean up the expanded prompt
        const cleanedPrompt = expandedPrompt
          .replace(/^"|"$/g, '') // Remove quotes
          .replace(/^Prompt mở rộng:\s*/i, '') // Remove prefix
          .replace(/^.*?:\s*/i, '') // Remove any prefix with colon
          .trim();
        
        console.log('Cleaned prompt:', cleanedPrompt);
        
        if (cleanedPrompt && cleanedPrompt !== currentPrompt) {
          if (promptType === 'text') {
            textForm.setValue('prompt', cleanedPrompt);
          } else {
            imageForm.setValue('prompt', cleanedPrompt);
          }
          
          toast({
            title: "Prompt đã được mở rộng!",
            description: "Prompt của bạn đã được viết lại chi tiết hơn.",
          });
        } else {
          toast({
            title: "Không có thay đổi",
            description: "AI không thể cải thiện prompt này thêm.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Không thể mở rộng prompt",
          description: "Không nhận được phản hồi từ AI. Vui lòng thử lại.",
          variant: "destructive",
        });
      }
      
      setIsExpandingPrompt(false);
      setExpandingPromptType(null);
    });

    websocket.addEventListener("error", (error) => {
      receiving = false;
      if (timeoutId) clearTimeout(timeoutId);
      console.error("WebSocket error:", error);
      toast({
        title: "Lỗi kết nối",
        description: "Không thể kết nối đến dịch vụ mở rộng prompt. Kiểm tra kết nối internet.",
        variant: "destructive",
      });
      setIsExpandingPrompt(false);
      setExpandingPromptType(null);
    });
  };

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
      // Estimate 300 seconds (5 minutes) for completion - STLIX can take longer
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
    } else if (videoStatus?.status === "enhancing") {
      // Video is being enhanced
      setLoadingProgress(90); // Show 90% progress during enhancement
      toast({
        title: "Đang nâng cao chất lượng video",
        description: "Video đang được nâng cao chất lượng bằng AI. Vui lòng chờ...",
      });
    } else if (videoStatus?.status === "processing") {
      const elapsedSeconds = loadingStartTime ? (new Date().getTime() - loadingStartTime.getTime()) / 1000 : 0;
      
      // Timeout after 8 minutes for veo3_fast, 12 minutes for veo3
      const timeoutSeconds = 480; // 8 minutes for veo3_fast, could extend to 720 for veo3
      
      if (elapsedSeconds > timeoutSeconds) {
        setIsLoadingModalOpen(false);
        showPopup(
          "Timeout - Video quá lâu", 
          "Video đã vượt quá thời gian xử lý bình thường. Có thể STLIX đang quá tải. Vui lòng thử tạo video mới với prompt ngắn gọn hơn.", 
          "warning"
        );
      } else if (elapsedSeconds > 180) { // 3 minutes
        const remainingMinutes = Math.ceil((timeoutSeconds - elapsedSeconds) / 60);
        toast({
          title: "Video đang được xử lý",
          description: `STLIX đang tạo video phức tạp. Còn tối đa ${remainingMinutes} phút nữa.`,
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

  // Helper function to create image from URL
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
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
    // Check if STLix Premium is disabled
    if (data.model === "veo3" && (!veo3PremiumStatus || (veo3PremiumStatus as any)?.enabled !== true)) {
      toast({
        title: "Mô hình đang bảo trì",
        description: "Mô hình STLix Cao Cấp hiện đang bảo trì. Vui lòng chọn mô hình khác.",
        variant: "destructive",
      });
      return;
    }
    
    generateVideoMutation.mutate({
      ...data,
      type: "text-to-video",
      userId: user?.id || "",
    });
  };

  const onImageToVideoSubmit = (data: ImageToVideoForm) => {
    // Check if STLix Premium is disabled
    if (data.model === "veo3" && (!veo3PremiumStatus || (veo3PremiumStatus as any)?.enabled !== true)) {
      toast({
        title: "Mô hình đang bảo trì",
        description: "Mô hình STLix Cao Cấp hiện đang bảo trì. Vui lòng chọn mô hình khác.",
        variant: "destructive",
      });
      return;
    }
    
    generateVideoMutation.mutate({
      ...data,
      type: "image-to-video",
      userId: user?.id || "",
    });
  };


  return (
    <div>
      {/* Header - Fluent Design 2 iOS Top App Bar */}
      <header className="fluent-glass-strong sticky top-0 z-50 fluent-shadow-soft">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo Section */}
            <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
              <img src={logoUrl} alt="Starlix Logo" className="h-8 sm:h-10 w-auto" />
              <h1 className="fluent-title-medium text-[var(--fluent-brand-primary)]">
                Starlix
              </h1>
            </div>
            
            {/* Navigation Actions */}
            <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3 flex-shrink-0">
              {/* User Info */}
              <div className="hidden sm:flex items-center space-x-2 mr-1 md:mr-2">
                <User className="w-4 h-4 text-[var(--fluent-brand-primary)]" />
                <span className="fluent-body-medium text-[var(--fluent-neutral-foreground-1)] truncate max-w-[100px]">
                  {user?.username}
                </span>
              </div>
              
              {/* Credit Balance */}
              <CreditBalance />
              
              
              {/* Object Replacement Button */}
              <Link href="/photai-tools">
                <Button 
                  variant="outlined"
                  size="sm"
                  className="hidden sm:flex"
                  data-testid="nav-photai-tools"
                >
                  <Edit className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden md:inline">Thay thế đối tượng</span>
                </Button>
              </Link>
              
              {/* Mobile Object Replacement Button */}
              <Link href="/photai-tools" className="sm:hidden">
                <Button 
                  variant="text"
                  size="sm"
                  data-testid="nav-photai-tools-mobile"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </Link>
              
              {/* Nhận Credit Button */}
              <Link href="/get-credit">
                <Button 
                  variant="outlined"
                  size="sm"
                  className="hidden sm:flex"
                  data-testid="nav-get-credit"
                >
                  <Link2 className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden md:inline">Nhận Credit</span>
                </Button>
              </Link>
              
              {/* Mobile Nhận Credit Button */}
              <Link href="/get-credit" className="sm:hidden">
                <Button 
                  variant="text"
                  size="sm"
                  data-testid="nav-get-credit-mobile"
                >
                  <Link2 className="w-4 h-4" />
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
            <div className="fluent-glass rounded-[var(--fluent-border-radius-large)] overflow-hidden fluent-shadow-medium">
              {/* Tab Navigation - Fluent Design 2 iOS Secondary Navigation */}
              <div className="flex border-b border-[var(--fluent-neutral-stroke-1)]">
                <button
                  className={`flex-1 px-4 py-4 border-b-2 transition-all duration-300 fluent-title-small ${
                    activeTab === "text-to-video"
                      ? "fluent-glass-strong text-[var(--fluent-brand-primary)] border-[var(--fluent-brand-primary)]"
                      : "text-[var(--fluent-neutral-foreground-3)] hover:text-[var(--fluent-neutral-foreground-1)] hover:fluent-glass-subtle border-transparent"
                  }`}
                  onClick={() => setActiveTab("text-to-video")}
                  data-testid="tab-text-to-video"
                >
                  <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-xs sm:text-sm">Văn bản</span>
                  </div>
                </button>
                <button
                  className={`flex-1 px-4 py-4 border-b-2 transition-all duration-300 fluent-title-small ${
                    activeTab === "image-to-video"
                      ? "fluent-glass-strong text-[var(--fluent-brand-primary)] border-[var(--fluent-brand-primary)]"
                      : "text-[var(--fluent-neutral-foreground-3)] hover:text-[var(--fluent-neutral-foreground-1)] hover:fluent-glass-subtle border-transparent"
                  }`}
                  onClick={() => setActiveTab("image-to-video")}
                  data-testid="tab-image-to-video"
                >
                  <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                    <Image className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-xs sm:text-sm">Tạo Video</span>
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
                            <FormLabel className="fluent-body-medium text-[var(--fluent-neutral-foreground-1)] mb-4 block">Mô tả Video</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Textarea
                                  placeholder="Mô tả video của bạn... (ví dụ: 'Một chú chó golden retriever chơi đùa trong công viên đầy nắng, quay chậm, ánh sáng điện ảnh')"
                                  data-testid="input-text-prompt"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => expandPrompt(field.value, 'text')}
                                  disabled={isExpandingPrompt || !field.value.trim()}
                                  className="absolute bottom-2 right-2 p-2 rounded-full bg-[var(--fluent-brand-primary)] text-white hover:bg-[var(--fluent-brand-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  data-testid="button-expand-text-prompt"
                                  title="Mở rộng prompt chi tiết hơn"
                                >
                                  {isExpandingPrompt && expandingPromptType === 'text' ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Edit className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <div className="flex justify-between text-xs text-[var(--fluent-neutral-foreground-3)]">
                              <span>Hãy cụ thể về ánh sáng, góc máy quay và phong cách</span>
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
                              <FormLabel className="fluent-body-medium text-[var(--fluent-neutral-foreground-1)] mb-2 block">Tỷ lệ khung hình</FormLabel>
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
                                  <span className="fluent-body-medium">
                                    {field.value ? aspectRatioOptions.find(opt => opt.value === field.value)?.label : "Chọn tỷ lệ khung hình"}
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
                              <FormLabel className="fluent-body-medium text-[var(--fluent-neutral-foreground-1)] mb-2 block">Mô hình AI</FormLabel>
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
                                  <span className="fluent-body-medium">
                                    {field.value ? modelOptions.find(opt => opt.value === field.value)?.label : "Chọn mô hình AI"}
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
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-[var(--fluent-neutral-foreground-2)] hover:text-[var(--fluent-neutral-foreground-1)] transition-colors">
                          Tùy chọn nâng cao
                          <ChevronDown className="w-5 h-5 transform transition-transform data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-4 space-y-4 pl-4">
                          <FormField
                            control={textForm.control}
                            name="watermark"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="fluent-body-medium text-[var(--fluent-neutral-foreground-1)] mb-4 block">Watermark (Tùy chọn)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Tên thương hiệu của bạn"
                                    data-testid="input-watermark"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={textForm.control}
                            name="hdGeneration"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 rounded-[var(--fluent-border-radius-medium)] fluent-glass-subtle">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="mt-1"
                                    data-testid="checkbox-hd-generation"
                                  />
                                </FormControl>
                                <FormLabel className="fluent-body-medium text-[var(--fluent-neutral-foreground-1)] cursor-pointer">
                                  Tạo phiên bản HD 1080P (+2 credits)
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        </CollapsibleContent>
                      </Collapsible>

                      <Button
                        type="submit"
                        variant="3d-primary"
                        disabled={generateVideoMutation.isPending}
                        className="w-full h-14 fluent-title-medium"
                        data-testid="button-generate-text-video"
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        <span>
                          {generateVideoMutation.isPending ? "Đang tạo..." : "Tạo Video"}
                        </span>
                        <span className="ml-2 px-2 py-1 bg-white/20 rounded-full fluent-caption">
                          10 credits
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
                            <FormLabel className="fluent-body-medium text-[var(--fluent-neutral-foreground-1)]">Tải lên ảnh</FormLabel>
                            <FormControl>
                              {!uploadedImageUrl ? (
                                <div 
                                  className="border-2 border-dashed border-[var(--fluent-neutral-stroke-1)] rounded-[var(--fluent-border-radius-medium)] p-8 text-center hover:border-[var(--fluent-brand-primary)] transition-colors cursor-pointer fluent-glass-subtle"
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
                                  <Upload className="w-12 h-12 text-[var(--fluent-neutral-foreground-3)] mx-auto mb-4" />
                                  <div className="text-sm text-[var(--fluent-neutral-foreground-2)]">
                                    <span className="text-[var(--fluent-brand-primary)] font-medium">Nhấn để tải lên</span> hoặc kéo thả
                                  </div>
                                  <p className="text-xs text-[var(--fluent-neutral-foreground-3)] mt-2">PNG, JPG, GIF tối đa 10MB</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {/* Image Preview */}
                                  <div className="relative rounded-[var(--fluent-border-radius-medium)] overflow-hidden fluent-glass-subtle">
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
                                      className="fluent-glass-subtle text-[var(--fluent-neutral-foreground-1)] hover:fluent-glass"
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
                                      className="fluent-glass-subtle text-[var(--fluent-neutral-foreground-1)] hover:fluent-glass"
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
                            <FormLabel className="fluent-body-medium text-[var(--fluent-neutral-foreground-1)] mb-4 block">Prompt Chuyển động</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Textarea
                                  placeholder="Mô tả cách ảnh sẽ chuyển động... (ví dụ: 'Người đó bắt đầu bước tới với những bước chân tự tin')"
                                  style={{minHeight: '100px'}}
                                  data-testid="input-motion-prompt"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => expandPrompt(field.value, 'image')}
                                  disabled={isExpandingPrompt || !field.value.trim()}
                                  className="absolute bottom-2 right-2 p-2 rounded-full bg-[var(--fluent-brand-primary)] text-white hover:bg-[var(--fluent-brand-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  data-testid="button-expand-motion-prompt"
                                  title="Mở rộng prompt chi tiết hơn"
                                >
                                  {isExpandingPrompt && expandingPromptType === 'image' ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Edit className="w-4 h-4" />
                                  )}
                                </button>
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
                              <FormLabel className="fluent-body-medium text-[var(--fluent-neutral-foreground-1)]">Tỷ lệ khung hình</FormLabel>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outlined"
                                  className="w-full justify-between"
                                  onClick={() => {
                                    setCurrentFormType("image");
                                    setAspectRatioModalOpen(true);
                                  }}
                                  data-testid="button-select-image-aspect-ratio"
                                >
                                  {field.value ? aspectRatioOptions.find(opt => opt.value === field.value)?.label : "Chọn tỷ lệ khung hình"}
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
                              <FormLabel className="fluent-body-medium text-[var(--fluent-neutral-foreground-1)]">Mô hình AI</FormLabel>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outlined"
                                  className="w-full justify-between"
                                  onClick={() => {
                                    setCurrentFormType("image");
                                    setModelModalOpen(true);
                                  }}
                                  data-testid="button-select-image-model"
                                >
                                  {field.value ? modelOptions.find(opt => opt.value === field.value)?.label : "Chọn mô hình AI"}
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button
                        type="submit"
                        variant="3d-primary"
                        disabled={generateVideoMutation.isPending || !uploadedImageUrl}
                        className="w-full h-14 fluent-title-medium"
                        data-testid="button-generate-image-video"
                      >
                        <Image className="w-5 h-5 mr-2" />
                        <span>
                          {generateVideoMutation.isPending ? "Đang tạo hiệu ứng..." : "Tạo hiệu ứng cho Ảnh"}
                        </span>
                        <span className="ml-2 px-2 py-1 bg-white/20 rounded-full fluent-caption">
                          10 credits
                        </span>
                      </Button>
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
            <h2 className="fluent-display-medium mb-4 bg-gradient-to-r from-[var(--fluent-neutral-foreground-1)] to-[var(--fluent-neutral-foreground-2)] bg-clip-text text-transparent">
              Được hỗ trợ bởi STLix AI
            </h2>
            <p className="fluent-body-large text-[var(--fluent-neutral-foreground-3)] max-w-2xl mx-auto">
              Tạo ra những video chất lượng cao tuyệt đẹp từ prompt văn bản hoặc tạo hiệu ứng cho ảnh của bạn với công nghệ AI tiên tiến nhất.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="fluent-glass rounded-[var(--fluent-border-radius-large)] p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-[var(--fluent-brand-primary)] to-[var(--fluent-brand-secondary)] rounded-[var(--fluent-border-radius-medium)] flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="fluent-title-small mb-2">Siêu Nhanh</h3>
              <p className="fluent-body-small text-[var(--fluent-neutral-foreground-3)]">Tạo video trong vài phút với API STLix được tối ưu hóa của chúng tôi</p>
            </div>
            
            <div className="fluent-glass rounded-[var(--fluent-border-radius-large)] p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-[var(--fluent-border-radius-medium)] flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="fluent-title-small mb-2">Chất Lượng Cao</h3>
              <p className="fluent-body-small text-[var(--fluent-neutral-foreground-3)]">Tạo video 1080P chất lượng chuyên nghiệp với chất lượng điện ảnh</p>
            </div>
            
            <div className="fluent-glass rounded-[var(--fluent-border-radius-large)] p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-[var(--fluent-border-radius-medium)] flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="fluent-title-small mb-2">Dễ Sử Dụng</h3>
              <p className="fluent-body-small text-[var(--fluent-neutral-foreground-3)]">Giao diện trực quan được thiết kế cho người sáng tạo ở mọi trình độ</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--fluent-neutral-stroke-1)] fluent-glass-strong mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Producer Information */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-3 mb-3">
              <img src={logoUrl} alt="Starlix Logo" className="h-6 w-auto" />
              <span className="fluent-body-medium text-[var(--fluent-neutral-foreground-1)]">Starlix</span>
            </div>
            <p className="fluent-body-small text-[var(--fluent-neutral-foreground-3)] mb-3">
              Được phát triển bởi <span className="text-[var(--fluent-brand-primary)] font-medium">Danh Trình</span>
            </p>
            
            {/* Social Media Links */}
            <div className="flex justify-center items-center space-x-4">
              <a 
                href="https://www.facebook.com/danhtrinh.official"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--fluent-neutral-foreground-3)] hover:text-[var(--fluent-brand-primary)] transition-colors"
                data-testid="link-facebook"
                title="Facebook"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a 
                href="https://www.tiktok.com/@trinz_ofc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--fluent-neutral-foreground-3)] hover:text-[var(--fluent-brand-primary)] transition-colors"
                data-testid="link-tiktok"
                title="TikTok"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
              <a 
                href="tel:0786831513"
                className="text-[var(--fluent-neutral-foreground-3)] hover:text-[var(--fluent-brand-primary)] transition-colors"
                data-testid="link-zalo"
                title="Zalo: 0786831513"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.33 2h9.34c2.94 0 5.33 2.39 5.33 5.33v9.34c0 2.94-2.39 5.33-5.33 5.33H7.33C4.39 22 2 19.61 2 16.67V7.33C2 4.39 4.39 2 7.33 2zm4.67 4.67c-2.21 0-4 1.79-4 4 0 .74.2 1.43.55 2.02L7.33 14l1.31-1.22c.59.35 1.28.55 2.02.55 2.21 0 4-1.79 4-4s-1.79-4-4-4z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--fluent-neutral-stroke-1)] pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-2 mb-4 md:mb-0">
                <span className="fluent-body-small text-[var(--fluent-neutral-foreground-3)]">
                  Được hỗ trợ bởi{" "}
                  <a 
                    href="https://veo3api.ai" 
                    className="text-[var(--fluent-brand-primary)] hover:text-[var(--fluent-brand-secondary)] transition-colors"
                    data-testid="link-veo3api"
                  >
                    STLix API
                  </a>
                </span>
              </div>
              
              <div className="flex space-x-6 fluent-body-small text-[var(--fluent-neutral-foreground-3)]">
                <a 
                  href="https://docs.veo3api.ai" 
                  className="hover:text-[var(--fluent-neutral-foreground-1)] transition-colors"
                  data-testid="link-documentation"
                >
                  Tài liệu
                </a>
                <a 
                  href="https://veo3api.ai/api-key" 
                  className="hover:text-[var(--fluent-neutral-foreground-1)] transition-colors"
                  data-testid="link-api-key"
                >
                  Lấy API Key
                </a>
                <a 
                  href="#" 
                  className="hover:text-[var(--fluent-neutral-foreground-1)] transition-colors"
                  data-testid="link-support"
                >
                  Hỗ trợ
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Loading Modal */}
      <Dialog open={isLoadingModalOpen} onOpenChange={(open) => !open && setIsLoadingModalOpen(false)}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogContent className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto border-0 p-0 shadow-none duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            <div className="fluent-glass-ultra backdrop-blur-2xl rounded-[var(--fluent-border-radius-large)] p-6 md:p-8 text-center text-[var(--fluent-neutral-foreground-3)] fluent-shadow-ultra">
              {/* Header */}
              <div className="mb-6">
                <h1 className="fluent-title-large md:fluent-display-large text-[var(--fluent-neutral-foreground-1)] mb-2">Đang tạo video</h1>
              </div>
              
              {/* Loading Container */}
              <div className="mb-8">
                <MD3VideoProcessingLoading 
                  progress={loadingProgress / 100}
                  data-testid="loading-video-processing"
                />
              </div>
              
              <h2 className="fluent-body-large md:fluent-title-large text-[var(--fluent-neutral-foreground-2)] mb-6">
                {loadingProgress >= 90 ? "Đang nâng cao chất lượng video..." : "Đang tạo video của bạn..."}
              </h2>
              
              <div className="mb-6">
                <Progress 
                  value={loadingProgress} 
                  className="h-3 md:h-4 fluent-glass-subtle"
                  data-testid="modal-progress-bar"
                />
              </div>
              
              <div className="flex justify-between items-center fluent-body-medium text-[var(--fluent-neutral-foreground-3)]">
                <span data-testid="modal-progress-percentage" className="font-semibold text-[var(--fluent-brand-primary)]">{Math.round(loadingProgress)}%</span>
                <span>
                  {loadingProgress >= 90 
                    ? "Đang nâng cao chất lượng..." 
                    : `~${Math.max(0, 120 - Math.round((new Date().getTime() - (loadingStartTime?.getTime() || 0)) / 1000))}s còn lại`
                  }
                </span>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Aspect Ratio Selection Modal */}
      <Dialog open={aspectRatioModalOpen} onOpenChange={setAspectRatioModalOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/50 z-50" />
          <DialogContent className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 fluent-glass-strong rounded-[var(--fluent-border-radius-large)] p-4 w-[95vw] max-w-sm max-h-[85vh] overflow-y-auto z-50 fluent-shadow-large">
            <DialogHeader>
              <DialogTitle className="fluent-title-large text-[var(--fluent-neutral-foreground-1)] mb-4">Chọn Tỷ lệ khung hình</DialogTitle>
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
                    className={`w-full p-3 rounded-[var(--fluent-border-radius-medium)] transition-all ${
                      isSelected 
                        ? 'fluent-glass-strong border-[var(--fluent-brand-primary)] text-[var(--fluent-brand-primary)]' 
                        : 'fluent-glass-subtle text-[var(--fluent-neutral-foreground-1)] hover:border-[var(--fluent-brand-primary)] hover:fluent-glass'
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
                        <IconComponent className="w-6 h-6 text-[var(--fluent-brand-primary)]" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-sm truncate">{option.label}</h3>
                          <span className="text-xs text-[var(--fluent-neutral-foreground-3)] ml-2 flex-shrink-0">{option.dimensions}</span>
                        </div>
                        <p className="text-xs text-[var(--fluent-neutral-foreground-3)] leading-tight">{option.description}</p>
                        <div className="mt-1 text-xs font-mono text-[var(--fluent-brand-secondary)]">
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
          <DialogContent className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 fluent-glass-strong rounded-[var(--fluent-border-radius-large)] p-4 w-[95vw] max-w-sm max-h-[85vh] overflow-y-auto z-50 fluent-shadow-large">
            <DialogHeader>
              <DialogTitle className="fluent-title-large text-[var(--fluent-neutral-foreground-1)] mb-4">Chọn Mô hình AI</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {modelOptions.map((option) => {
                const IconComponent = option.icon;
                const currentValue = currentFormType === "text" 
                  ? textForm.getValues().model 
                  : imageForm.getValues().model;
                const isSelected = currentValue === option.value;
                const isSTLixPremium = option.value === "veo3";
                const isSTLixPremiumDisabled = isSTLixPremium && (!veo3PremiumStatus || (veo3PremiumStatus as any)?.enabled !== true);
                
                return (
                  <button
                    key={option.value}
                    disabled={isSTLixPremiumDisabled}
                    className={`w-full p-3 rounded-[var(--fluent-border-radius-medium)] transition-all ${
                      isSTLixPremiumDisabled
                        ? 'fluent-glass-subtle opacity-50 cursor-not-allowed border-red-600 bg-red-900/20'
                        : isSelected 
                          ? 'fluent-glass-strong border-[var(--fluent-brand-primary)] text-[var(--fluent-brand-primary)]' 
                          : 'fluent-glass-subtle text-[var(--fluent-neutral-foreground-1)] hover:border-[var(--fluent-brand-primary)] hover:fluent-glass'
                    }`}
                    onClick={() => {
                      if (isSTLixPremiumDisabled) return;
                      
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
                        <IconComponent className="w-6 h-6 text-[var(--fluent-brand-primary)]" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-start justify-between mb-1 gap-2">
                          <h3 className="font-semibold text-sm truncate">{option.label}</h3>
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            <span className="text-xs bg-[var(--fluent-brand-primary)] px-1.5 py-0.5 rounded-full text-white">{option.badge}</span>
                            <span className="text-xs text-[var(--fluent-brand-primary)]">{option.credits}c</span>
                          </div>
                        </div>
                        <p className="text-xs text-[var(--fluent-neutral-foreground-3)] leading-tight mb-2">{option.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {option.features.map((feature, index) => (
                            <span 
                              key={index}
                              className="text-xs fluent-glass-subtle px-1.5 py-0.5 rounded text-[var(--fluent-neutral-foreground-2)]"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                        {isSTLixPremiumDisabled && (
                          <div className="mt-2 p-2 bg-red-900/20 border border-red-600 rounded-md">
                            <div className="flex items-center space-x-2">
                              <X className="w-3 h-3 text-red-400" />
                              <span className="text-xs text-red-300 font-medium">
                                Mô hình đang bảo trì
                              </span>
                            </div>
                            <p className="text-xs text-red-400 mt-1">
                              Vui lòng chọn mô hình khác hoặc liên hệ admin
                            </p>
                          </div>
                        )}
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
          <DialogContent className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fluent-glass-strong rounded-[var(--fluent-border-radius-large)] p-6 max-w-4xl w-full max-h-[90vh] overflow-auto z-50 fluent-shadow-large">
            <DialogHeader>
              <DialogTitle className="fluent-title-large text-[var(--fluent-neutral-foreground-1)] mb-4">Cắt ảnh</DialogTitle>
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
