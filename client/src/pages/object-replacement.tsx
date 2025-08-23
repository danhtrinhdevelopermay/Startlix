import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { ArrowUploadRegular, ImageRegular, EditRegular, PersonRegular, SignOutRegular, SparkleRegular, LinkRegular, EraserRegular, PaintBrushRegular, ArrowUndoRegular, DeleteRegular } from "@fluentui/react-icons";
import { Link } from "wouter";
import { MD3ButtonLoading } from "@/components/md3-loading-indicator";
import CreditBalance from "@/components/credit-balance";

const objectReplacementSchema = z.object({
  fileName: z.string().min(1, "Tên file không được để trống"),
  prompt: z.string().min(5, "Prompt phải có ít nhất 5 ký tự").max(200, "Prompt phải có ít hơn 200 ký tự"),
  inputImageUrl: z.string().url("URL ảnh không hợp lệ"), 
  maskImageBase64: z.string().min(1, "Vui lòng vẽ mask trên ảnh"),
});

type ObjectReplacementForm = z.infer<typeof objectReplacementSchema>;

interface ObjectReplacement {
  id: string;
  userId: string;
  fileName: string;
  prompt: string;
  inputImageUrl: string;
  maskImageBase64: string;
  status: string;
  resultImageUrl: string | null;
  errorMessage: string | null;
  creditsUsed: number;
  createdAt: string | null;
  completedAt: string | null;
}

export default function ObjectReplacementPage() {
  const { user } = useAuth();
  const logoutMutation = useLogout();
  const { toast } = useToast();
  const [inputImageFile, setInputImageFile] = useState<File | null>(null);
  const [inputImagePreview, setInputImagePreview] = useState<string>("");
  const [inputImageUrl, setInputImageUrl] = useState<string>("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [drawingMode, setDrawingMode] = useState<'draw' | 'erase'>('draw');
  const [maskDataUrl, setMaskDataUrl] = useState<string>("");
  
  const inputFileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const form = useForm<ObjectReplacementForm>({
    resolver: zodResolver(objectReplacementSchema),
    defaultValues: {
      fileName: "",
      prompt: "",
      inputImageUrl: "",
      maskImageBase64: "",
    },
  });

  // Fetch user's object replacements
  const { data: replacements = [], isLoading: replacementsLoading } = useQuery<ObjectReplacement[]>({
    queryKey: ["/api/object-replacements"],
  });

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      return response.json();
    },
    onSuccess: (data, file) => {
      if (file === inputImageFile) {
        const imageUrl = data.downloadUrl || data.imageUrl;
        setInputImageUrl(imageUrl);
        form.setValue("inputImageUrl", imageUrl);
        form.setValue("fileName", file.name);
        toast({
          title: "✅ Tải ảnh thành công",
          description: "Ảnh gốc đã được tải lên. Bây giờ hãy vẽ mask.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "❌ Lỗi tải ảnh",
        description: error.message || "Không thể tải ảnh lên",
        variant: "destructive",
      });
    },
  });

  // Object replacement mutation
  const objectReplacementMutation = useMutation({
    mutationFn: async (data: ObjectReplacementForm) => {
      console.log('🔄 Making API request with data:', data);
      const response = await apiRequest("POST", "/api/object-replacement", data);
      console.log('✅ API response received:', response);
      return response;
    },
    onSuccess: (data: any) => {
      console.log('✅ Object replacement successful:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/object-replacements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({
        title: "✅ Thay thế đối tượng thành công",
        description: `Đã hoàn thành! Sử dụng ${data.creditsUsed || 2} credits.`,
      });
      // Reset form after successful replacement
      form.reset();
      setInputImageFile(null);
      setInputImagePreview("");
      setInputImageUrl("");
      setMaskDataUrl("");
      clearCanvas();
    },
    onError: (error: any) => {
      console.error('❌ Object replacement error:', error);
      let errorMessage = "Không thể thay thế đối tượng";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "❌ Lỗi thay thế đối tượng",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Initialize canvas when image loads
  useEffect(() => {
    if (inputImagePreview && canvasRef.current && imageRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = imageRef.current;
      
      img.onload = () => {
        // Set canvas size to match image
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        // Set canvas display size
        const containerWidth = canvas.parentElement?.clientWidth || 400;
        const scale = Math.min(containerWidth / img.naturalWidth, 400 / img.naturalHeight);
        canvas.style.width = `${img.naturalWidth * scale}px`;
        canvas.style.height = `${img.naturalHeight * scale}px`;
        
        // Clear canvas with transparent background
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };
    }
  }, [inputImagePreview]);

  const getEventPosition = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    
    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    return { x, y };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    draw(e);
  }, []);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    updateMaskData();
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling on touch
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { x, y } = getEventPosition(e);
    
    ctx.globalCompositeOperation = drawingMode === 'draw' ? 'source-over' : 'destination-out';
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
  }, [isDrawing, brushSize, drawingMode, getEventPosition]);

  const updateMaskData = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    setMaskDataUrl(dataUrl);
    form.setValue("maskImageBase64", dataUrl);
  }, [form]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setMaskDataUrl("");
    form.setValue("maskImageBase64", "");
  }, [form]);

  const handleInputImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setInputImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setInputImagePreview(previewUrl);
      uploadImageMutation.mutate(file);
      // Clear any existing mask
      setMaskDataUrl("");
      form.setValue("maskImageBase64", "");
    }
  };

  const onSubmit = (data: ObjectReplacementForm) => {
    console.log('🔄 Form submission started:', data);
    console.log('🔄 Form state:', {
      inputImageFile: !!inputImageFile,
      inputImageUrl,
      maskDataUrl: !!maskDataUrl,
      formData: data
    });
    
    if (!inputImageFile) {
      toast({
        title: "❌ Thiếu ảnh",
        description: "Vui lòng tải lên ảnh gốc",
        variant: "destructive",
      });
      return;
    }
    
    if (!maskDataUrl) {
      toast({
        title: "❌ Thiếu mask",
        description: "Vui lòng vẽ mask trên ảnh để chỉ định vùng cần thay thế",
        variant: "destructive",
      });
      return;
    }

    if (!data.inputImageUrl) {
      toast({
        title: "❌ Lỗi URL ảnh",
        description: "URL ảnh không hợp lệ. Vui lòng tải lại ảnh.",
        variant: "destructive",
      });
      return;
    }

    if (!data.prompt || data.prompt.trim().length < 5) {
      toast({
        title: "❌ Thiếu mô tả",
        description: "Vui lòng nhập mô tả chi tiết về đối tượng muốn thay thế (ít nhất 5 ký tự)",
        variant: "destructive",
      });
      return;
    }
    
    console.log('✅ All validation passed, submitting request');
    objectReplacementMutation.mutate(data);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700">
      {/* Header */}
      <header className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-b border-gray-200/20 dark:border-gray-700/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <ImageRegular className="w-8 h-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Thay thế đối tượng AI
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <CreditBalance />
              
              <Link to="/">
                <Button variant="ghost" size="sm" data-testid="button-home">
                  <SparkleRegular className="w-4 h-4 mr-2" />
                  Tạo video
                </Button>
              </Link>
              
              <Link to="/get-credit">
                <Button variant="ghost" size="sm" data-testid="button-get-credit">
                  <LinkRegular className="w-4 h-4 mr-2" />
                  Nhận credit
                </Button>
              </Link>

              <div className="flex items-center space-x-2">
                <PersonRegular className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {user?.username}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  <SignOutRegular className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload and Drawing Tools */}
          <div className="space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <EditRegular className="w-5 h-5 text-purple-600" />
                  Thay thế đối tượng trong ảnh
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Input Image Upload */}
                    <div className="space-y-4">
                      <FormLabel>Ảnh gốc</FormLabel>
                      <div
                        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition-colors"
                        onClick={() => inputFileRef.current?.click()}
                        data-testid="upload-input-image"
                      >
                        {inputImagePreview ? (
                          <div className="space-y-2">
                            <img
                              ref={imageRef}
                              src={inputImagePreview}
                              alt="Input preview"
                              className="max-h-48 mx-auto rounded-lg"
                            />
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {inputImageFile?.name}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <ArrowUploadRegular className="w-12 h-12 text-gray-400 mx-auto" />
                            <p className="text-gray-600 dark:text-gray-400">
                              Nhấp để tải lên ảnh gốc
                            </p>
                          </div>
                        )}
                      </div>
                      <input
                        ref={inputFileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleInputImageUpload}
                        className="hidden"
                      />
                    </div>

                    {/* Prompt Field */}
                    <FormField
                      control={form.control}
                      name="prompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mô tả đối tượng thay thế</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ví dụ: một chiếc xe hơi màu đỏ, một chú chó golden retriever, một cái cây..."
                              data-testid="input-prompt"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Mô tả những gì bạn muốn thay thế vào vùng đã vẽ mask (5-200 ký tự)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Drawing Tools */}
                    {inputImagePreview && (
                      <div className="space-y-4">
                        <FormLabel>Vẽ mask (vùng cần thay thế)</FormLabel>
                        <FormDescription>
                          Vẽ trực tiếp lên ảnh để chỉ định vùng cần thay thế. Vùng màu trắng sẽ được thay thế.
                        </FormDescription>
                        
                        {/* Drawing Controls */}
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Button
                              type="button"
                              variant={drawingMode === 'draw' ? 'filled' : 'outlined'}
                              size="sm"
                              onClick={() => setDrawingMode('draw')}
                              data-testid="button-draw-mode"
                            >
                              <PaintBrushRegular className="w-4 h-4 mr-2" />
                              Vẽ
                            </Button>
                            <Button
                              type="button"
                              variant={drawingMode === 'erase' ? 'filled' : 'outlined'}
                              size="sm"
                              onClick={() => setDrawingMode('erase')}
                              data-testid="button-erase-mode"
                            >
                              <EraserRegular className="w-4 h-4 mr-2" />
                              Xóa
                            </Button>
                          </div>
                          
                          <div className="flex items-center space-x-2 flex-1">
                            <span className="text-sm">Kích thước:</span>
                            <Slider
                              value={[brushSize]}
                              onValueChange={(value) => setBrushSize(value[0])}
                              max={50}
                              min={5}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-sm w-8">{brushSize}</span>
                          </div>
                          
                          <Button
                            type="button"
                            variant="outlined"
                            size="sm"
                            onClick={clearCanvas}
                            data-testid="button-clear-mask"
                          >
                            <DeleteRegular className="w-4 h-4 mr-2" />
                            Xóa hết
                          </Button>
                        </div>

                        {/* Drawing Canvas */}
                        <div className="relative bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                          <div className="relative inline-block">
                            <img
                              src={inputImagePreview}
                              alt="Input for drawing"
                              className="max-w-full h-auto rounded-lg"
                              style={{ maxHeight: '400px' }}
                            />
                            <canvas
                              ref={canvasRef}
                              className="absolute top-0 left-0 cursor-crosshair rounded-lg touch-none"
                              onMouseDown={startDrawing}
                              onMouseUp={stopDrawing}
                              onMouseMove={draw}
                              onMouseLeave={stopDrawing}
                              onTouchStart={startDrawing}
                              onTouchEnd={stopDrawing}
                              onTouchMove={draw}
                              style={{ 
                                background: 'transparent',
                                maxHeight: '400px',
                                touchAction: 'none'
                              }}
                            />
                          </div>
                        </div>

                        {/* Mask Preview */}
                        {maskDataUrl && (
                          <div className="space-y-2">
                            <FormLabel>Xem trước mask</FormLabel>
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                              <img
                                src={maskDataUrl}
                                alt="Mask preview"
                                className="max-h-32 mx-auto rounded-lg"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={objectReplacementMutation.isPending || uploadImageMutation.isPending || !maskDataUrl || !inputImageUrl}
                      data-testid="button-replace-object"
                      onClick={() => {
                        console.log('🔄 Replace button clicked:', {
                          isPending: objectReplacementMutation.isPending,
                          isUploading: uploadImageMutation.isPending,
                          hasMask: !!maskDataUrl,
                          hasImageUrl: !!inputImageUrl,
                          formValues: form.getValues()
                        });
                      }}
                    >
                      {objectReplacementMutation.isPending ? (
                        <MD3ButtonLoading label="Đang thay thế đối tượng..." />
                      ) : (
                        <>
                          <SparkleRegular className="w-4 h-4 mr-2" />
                          Thay thế đối tượng (2 credits)
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Results History */}
          <div className="space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Lịch sử thay thế</CardTitle>
              </CardHeader>
              <CardContent>
                {replacementsLoading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 dark:text-gray-400">Đang tải...</p>
                  </div>
                ) : replacements.length === 0 ? (
                  <div className="text-center py-8">
                    <ImageRegular className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Chưa có thao tác thay thế nào
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {replacements.map((replacement) => (
                      <div
                        key={replacement.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-sm">{replacement.fileName}</p>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              replacement.status === "completed"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : replacement.status === "failed"
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            }`}
                          >
                            {replacement.status === "completed" ? "Hoàn thành" : 
                             replacement.status === "failed" ? "Thất bại" : "Đang xử lý"}
                          </span>
                        </div>
                        
                        {replacement.resultImageUrl && (
                          <div className="space-y-2">
                            <img
                              src={replacement.resultImageUrl}
                              alt="Kết quả"
                              className="w-full max-h-48 object-contain rounded-lg"
                            />
                            <Button
                              variant="outlined"
                              size="sm"
                              onClick={() => window.open(replacement.resultImageUrl!, "_blank")}
                              className="w-full"
                            >
                              Xem ảnh kết quả
                            </Button>
                          </div>
                        )}
                        
                        {replacement.errorMessage && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-2">
                            {replacement.errorMessage}
                          </p>
                        )}
                        
                        <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>Credits: {replacement.creditsUsed}</span>
                          <span>
                            {replacement.createdAt && new Date(replacement.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}