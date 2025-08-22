import { useState, useRef, useEffect } from "react";
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
import { ChevronDown, Upload, Sparkles, Image, FileText, LogOut, User } from "lucide-react";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import loadingGif from "@assets/original-568544560f6ca1076a16e3428302e329_1755778026559.gif";
import starlixLogo from "@assets/Dự án mới 32 [6F4A9A3]_1755821175424.png";

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

export default function VideoGenerator() {
  const { user } = useAuth();
  const logoutMutation = useLogout();
  const [activeTab, setActiveTab] = useState<"text-to-video" | "image-to-video">("text-to-video");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [uploadedImageName, setUploadedImageName] = useState<string>("");
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>("");
  const [currentTaskId, setCurrentTaskId] = useState<string>("");
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState<boolean>(false);
  const [loadingStartTime, setLoadingStartTime] = useState<Date | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
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

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiRequest("POST", "/api/upload-image", formData);
      return await response.json();
    },
    onSuccess: (data) => {
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
      {/* Header */}
      <header className="border-b border-dark-600 bg-dark-700/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <img src={starlixLogo} alt="Starlix Logo" className="h-8 w-auto" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary-500 to-purple-400 bg-clip-text text-transparent">
                Starlix
              </h1>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3 text-sm">
                <User className="w-4 h-4 text-purple-400" />
                <span className="text-gray-300">
                  {user?.username}
                </span>
              </div>
              <CreditBalance />
              <Link to="/admin" data-testid="link-admin">
                <Button 
                  variant="outline"
                  size="sm"
                  className="text-gray-300 border-gray-600 hover:bg-gray-700"
                >
                  Admin
                </Button>
              </Link>
              <Button 
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="text-gray-300 border-gray-600 hover:bg-gray-700"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {logoutMutation.isPending ? "Đang xuất..." : "Đăng xuất"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Generation Controls */}
          <div className="lg:col-span-2">
            <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-hidden">
              {/* Tab Navigation */}
              <div className="flex border-b border-dark-600">
                <Button
                  variant="ghost"
                  className={`flex-1 px-6 py-4 rounded-none border-b-2 transition-colors ${
                    activeTab === "text-to-video"
                      ? "bg-primary-600 text-white border-primary-500"
                      : "text-gray-400 hover:text-white hover:bg-dark-600 border-transparent"
                  }`}
                  onClick={() => setActiveTab("text-to-video")}
                  data-testid="tab-text-to-video"
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Text to Video</span>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  className={`flex-1 px-6 py-4 rounded-none border-b-2 transition-colors ${
                    activeTab === "image-to-video"
                      ? "bg-primary-600 text-white border-primary-500"
                      : "text-gray-400 hover:text-white hover:bg-dark-600 border-transparent"
                  }`}
                  onClick={() => setActiveTab("image-to-video")}
                  data-testid="tab-image-to-video"
                >
                  <div className="flex items-center space-x-2">
                    <Image className="w-5 h-5" />
                    <span>Image to Video</span>
                  </div>
                </Button>
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
                            <FormLabel className="text-gray-300">Video Prompt</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe your video... (e.g., 'A golden retriever playing fetch in a sunny park, slow motion, cinematic lighting')"
                                className="h-32 bg-dark-600 border-dark-500 text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                data-testid="input-text-prompt"
                                {...field}
                              />
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
                              <FormLabel className="text-gray-300">Aspect Ratio</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger 
                                    className="bg-dark-600 border-dark-500 text-white focus:ring-2 focus:ring-primary-500"
                                    data-testid="select-aspect-ratio"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-dark-600 border-dark-500">
                                  <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                                  <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={textForm.control}
                          name="model"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Model</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger 
                                    className="bg-dark-600 border-dark-500 text-white focus:ring-2 focus:ring-primary-500"
                                    data-testid="select-model"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-dark-600 border-dark-500">
                                  <SelectItem value="veo3">Veo3 (Best Quality)</SelectItem>
                                  <SelectItem value="veo3_fast">Veo3 Fast</SelectItem>
                                </SelectContent>
                              </Select>
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
                                <FormLabel className="text-gray-300">Watermark (Optional)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Your brand name"
                                    className="bg-dark-600 border-dark-500 text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500"
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
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="border-dark-500 text-primary-500 focus:ring-primary-500"
                                    data-testid="checkbox-hd-generation"
                                  />
                                </FormControl>
                                <FormLabel className="text-sm text-gray-300">
                                  Generate 1080P HD version (+2 credits)
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        </CollapsibleContent>
                      </Collapsible>

                      <button
                        type="submit"
                        disabled={generateVideoMutation.isPending}
                        className="premium-gen-button w-full"
                        data-testid="button-generate-text-video"
                      >
                        <div className="wrap">
                          <div className="content">
                            <span className="star">✧</span>
                            <span className="star">✦</span>
                            <Sparkles className="w-5 h-5" />
                            <span>
                              {generateVideoMutation.isPending ? "Generating..." : "Generate Video"}
                            </span>
                            <span className="text-xs bg-black/30 px-2 py-1 rounded-full">5 credits</span>
                          </div>
                        </div>
                      </button>
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
                                {uploadedImageName ? (
                                  <div className="space-y-2">
                                    <Upload className="w-12 h-12 text-green-400 mx-auto" />
                                    <div className="text-sm text-green-400">
                                      <span className="font-medium">Uploaded: {uploadedImageName}</span>
                                    </div>
                                    <p className="text-xs text-gray-400">Click to upload a different image</p>
                                  </div>
                                ) : (
                                  <div>
                                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                    <div className="text-sm text-gray-400">
                                      <span className="text-primary-400 font-medium">Click to upload</span> or drag and drop
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF up to 10MB</p>
                                  </div>
                                )}
                              </div>
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
                            <FormLabel className="text-gray-300">Motion Prompt</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe how the image should animate... (e.g., 'The person starts walking forward with confident steps')"
                                className="h-24 bg-dark-600 border-dark-500 text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 resize-none"
                                data-testid="input-motion-prompt"
                                {...field}
                              />
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
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger 
                                    className="bg-dark-600 border-dark-500 text-white focus:ring-2 focus:ring-primary-500"
                                    data-testid="select-image-aspect-ratio"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-dark-600 border-dark-500">
                                  <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                                  <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                                </SelectContent>
                              </Select>
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
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger 
                                    className="bg-dark-600 border-dark-500 text-white focus:ring-2 focus:ring-primary-500"
                                    data-testid="select-image-model"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-dark-600 border-dark-500">
                                  <SelectItem value="veo3">Veo3 (Best Quality)</SelectItem>
                                  <SelectItem value="veo3_fast">Veo3 Fast</SelectItem>
                                </SelectContent>
                              </Select>
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
          <DialogOverlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogContent className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] bg-dark-800/95 backdrop-blur-md border-dark-600 p-8 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl">
            <div className="text-center text-gray-400 w-full">
              <img 
                src={loadingGif} 
                alt="Loading video generation" 
                className="w-24 h-24 mx-auto mb-6" 
              />
              <h2 className="text-2xl font-bold text-white mb-2">Đang tạo video...</h2>
              <p className="text-lg mb-6 text-gray-300">Vui lòng chờ trong giây lát</p>
              
              <div className="mb-4">
                <Progress 
                  value={loadingProgress} 
                  className="h-4 bg-dark-600"
                  data-testid="modal-progress-bar"
                />
              </div>
              
              <div className="flex justify-between items-center text-sm text-gray-400">
                <span data-testid="modal-progress-percentage">{Math.round(loadingProgress)}%</span>
                <span>~{Math.max(0, 120 - Math.round((new Date().getTime() - (loadingStartTime?.getTime() || 0)) / 1000))}s còn lại</span>
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
