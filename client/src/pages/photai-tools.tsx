import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { CameraRegular, SparkleRegular, ImageRegular, EraserRegular, PaintBrushRegular, ColorRegular, WandRegular, ArrowUpRegular, TargetArrowRegular } from "@fluentui/react-icons";

// Schema for form validation
const photaiToolSchema = z.object({
  toolType: z.enum([
    "background-remover",
    "background-replacer",
    "image-extender",
    "object-remover",
    "text-to-art",
    "text-to-art-image",
    "upscaler",
    "ai-photo-enhancer",
    "ai-light-fix",
    "old-photo-restoration",
    "color-restoration",
    "ai-photo-coloriser",
    "ai-pattern-generator"
  ]),
  fileName: z.string().min(1, "Tên file không được để trống"),
  inputImageUrl: z.string().min(1, "Vui lòng tải lên ảnh"),
  prompt: z.string().optional(),
  maskImageBase64: z.string().optional(),
  backgroundPrompt: z.string().optional(),
  extendDirection: z.enum(["up", "down", "left", "right", "all"]).optional(),
  upscaleMethod: z.enum(["x2", "x4", "x8"]).optional(),
});

type PhotoaiToolForm = z.infer<typeof photaiToolSchema>;

// Tool definitions with icons and descriptions
const TOOLS = [
  {
    id: "background-remover",
    name: "Background Remover",
    nameVi: "Xóa Phông",
    description: "Tự động xóa phông nền khỏi ảnh",
    credits: 1,
    icon: EraserRegular,
    needsPrompt: false,
    needsMask: false,
    needsUpscale: false,
    needsDirection: false,
    needsBackground: false
  },
  {
    id: "background-replacer",
    name: "Background Replacer", 
    nameVi: "Thay Phông",
    description: "Thay đổi phông nền với prompt mô tả",
    credits: 2,
    icon: ImageRegular,
    needsPrompt: false,
    needsMask: true,
    needsUpscale: false,
    needsDirection: false,
    needsBackground: true
  },
  {
    id: "image-extender",
    name: "Image Extender",
    nameVi: "Mở Rộng Ảnh",
    description: "Mở rộng ảnh theo hướng mong muốn",
    credits: 1,
    icon: ArrowUpRegular,
    needsPrompt: false,
    needsMask: false,
    needsUpscale: false,
    needsDirection: true,
    needsBackground: false
  },
  {
    id: "object-remover",
    name: "Object Remover",
    nameVi: "Xóa Đối Tượng",
    description: "Xóa đối tượng khỏi ảnh với mask",
    credits: 2,
    icon: TargetArrowRegular,
    needsPrompt: false,
    needsMask: true,
    needsUpscale: false,
    needsDirection: false,
    needsBackground: false
  },
  {
    id: "text-to-art",
    name: "Text to Art",
    nameVi: "Văn Bản Thành Nghệ Thuật",
    description: "Tạo nghệ thuật từ văn bản mô tả",
    credits: 1,
    icon: WandRegular,
    needsPrompt: true,
    needsMask: false,
    needsUpscale: false,
    needsDirection: false,
    needsBackground: false
  },
  {
    id: "text-to-art-image",
    name: "Text to Art (Image to Image)",
    nameVi: "Văn Bản Thành Nghệ Thuật (Ảnh)",
    description: "Chuyển đổi ảnh thành nghệ thuật với prompt",
    credits: 1,
    icon: PaintBrushRegular,
    needsPrompt: true,
    needsMask: false,
    needsUpscale: false,
    needsDirection: false,
    needsBackground: false
  },
  {
    id: "upscaler",
    name: "Upscaler",
    nameVi: "Tăng Độ Phân Giải",
    description: "Tăng độ phân giải ảnh",
    credits: 1,
    icon: ArrowUpRegular,
    needsPrompt: false,
    needsMask: false,
    needsUpscale: true,
    needsDirection: false,
    needsBackground: false
  },
  {
    id: "ai-photo-enhancer",
    name: "AI Photo Enhancer",
    nameVi: "Tăng Cường Ảnh AI",
    description: "Tăng cường chất lượng ảnh bằng AI",
    credits: 2,
    icon: SparkleRegular,
    needsPrompt: false,
    needsMask: false,
    needsUpscale: false,
    needsDirection: false,
    needsBackground: false
  },
  {
    id: "ai-light-fix",
    name: "AI Light Fix",
    nameVi: "Sửa Ánh Sáng AI",
    description: "Cải thiện ánh sáng trong ảnh",
    credits: 1,
    icon: CameraRegular,
    needsPrompt: false,
    needsMask: false,
    needsUpscale: false,
    needsDirection: false,
    needsBackground: false
  },
  {
    id: "old-photo-restoration",
    name: "Old Photo Restoration",
    nameVi: "Khôi Phục Ảnh Cũ",
    description: "Khôi phục và sửa chữa ảnh cũ",
    credits: 2,
    icon: CameraRegular,
    needsPrompt: false,
    needsMask: false,
    needsUpscale: false,
    needsDirection: false,
    needsBackground: false
  },
  {
    id: "color-restoration",
    name: "Color Restoration",
    nameVi: "Khôi Phục Màu Sắc",
    description: "Khôi phục màu sắc cho ảnh",
    credits: 1,
    icon: ColorRegular,
    needsPrompt: false,
    needsMask: false,
    needsUpscale: false,
    needsDirection: false,
    needsBackground: false
  },
  {
    id: "ai-photo-coloriser",
    name: "AI Photo Coloriser",
    nameVi: "Tô Màu Ảnh AI",
    description: "Tô màu ảnh đen trắng bằng AI",
    credits: 1,
    icon: ColorRegular,
    needsPrompt: false,
    needsMask: false,
    needsUpscale: false,
    needsDirection: false,
    needsBackground: false
  },
  {
    id: "ai-pattern-generator",
    name: "AI Pattern Generator",
    nameVi: "Tạo Họa Tiết AI",
    description: "Tạo họa tiết từ ảnh với prompt",
    credits: 2,
    icon: WandRegular,
    needsPrompt: true,
    needsMask: false,
    needsUpscale: false,
    needsDirection: false,
    needsBackground: false
  }
];

export default function PhotoAIToolsPage() {
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [maskDataUrl, setMaskDataUrl] = useState<string>("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PhotoaiToolForm>({
    resolver: zodResolver(photaiToolSchema),
    defaultValues: {
      toolType: "background-remover",
      fileName: "",
      inputImageUrl: "",
      prompt: "",
      maskImageBase64: "",
      backgroundPrompt: "",
      extendDirection: "all",
      upscaleMethod: "x2",
    },
  });

  const selectedToolInfo = TOOLS.find(tool => tool.id === selectedTool);

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
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
      const imageUrl = data.downloadUrl || data.imageUrl;
      setImageUrl(imageUrl);
      form.setValue("inputImageUrl", imageUrl);
      form.setValue("fileName", file.name);
      toast({
        title: "✅ Tải ảnh thành công",
        description: "Ảnh đã được tải lên thành công.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Lỗi tải ảnh",
        description: error.message || "Không thể tải ảnh lên",
        variant: "destructive",
      });
    },
  });

  // Process tool mutation
  const processToolMutation = useMutation({
    mutationFn: async (data: PhotoaiToolForm) => {
      const response = await fetch("/api/photai-tools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to process");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🎉 Thành công!",
        description: `${selectedToolInfo?.nameVi} đã được xử lý thành công.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/photai-operations"] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Lỗi xử lý",
        description: error.message || "Không thể xử lý ảnh",
        variant: "destructive",
      });
    },
  });

  // Get user operations
  const { data: operations = [] } = useQuery<any[]>({
    queryKey: ["/api/photai-operations"],
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      uploadImageMutation.mutate(file);
    }
  };

  const handleMaskUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setMaskFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setMaskDataUrl(dataUrl);
        // Extract base64 part without the data URL prefix
        const base64 = dataUrl.split(',')[1];
        form.setValue("maskImageBase64", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (data: PhotoaiToolForm) => {
    if (!imageFile || !imageUrl) {
      toast({
        title: "❌ Thiếu ảnh",
        description: "Vui lòng tải lên ảnh trước.",
        variant: "destructive",
      });
      return;
    }

    // Validate tool-specific requirements
    if (selectedToolInfo?.needsMask && !maskDataUrl) {
      toast({
        title: "❌ Thiếu mask",
        description: "Công cụ này cần mask. Vui lòng tải lên ảnh mask.",
        variant: "destructive",
      });
      return;
    }

    if (selectedToolInfo?.needsPrompt && !data.prompt) {
      toast({
        title: "❌ Thiếu prompt",
        description: "Công cụ này cần mô tả. Vui lòng nhập prompt.",
        variant: "destructive",
      });
      return;
    }

    if (selectedToolInfo?.needsBackground && !data.backgroundPrompt) {
      toast({
        title: "❌ Thiếu mô tả phông",
        description: "Vui lòng nhập mô tả phông nền mới.",
        variant: "destructive",
      });
      return;
    }

    processToolMutation.mutate(data);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-center">Phot.AI Tools</h1>
        <p className="text-gray-600 dark:text-gray-300 text-center">
          Bộ công cụ AI chỉnh sửa ảnh chuyên nghiệp
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tool Selection and Form */}
        <div className="space-y-6">
          {/* Tool Selection Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Chọn Công Cụ</CardTitle>
              <CardDescription>
                Chọn công cụ AI phù hợp với nhu cầu của bạn
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {TOOLS.map((tool) => {
                  const IconComponent = tool.icon;
                  return (
                    <Button
                      key={tool.id}
                      variant={selectedTool === tool.id ? "default" : "outlined"}
                      className="h-auto p-3 flex flex-col items-center gap-2 text-xs"
                      onClick={() => {
                        setSelectedTool(tool.id);
                        form.setValue("toolType", tool.id as any);
                      }}
                      data-testid={`tool-${tool.id}`}
                    >
                      <IconComponent className="w-6 h-6" />
                      <div className="text-center">
                        <div className="font-medium">{tool.nameVi}</div>
                        <div className="text-xs opacity-70">{tool.credits} credit{tool.credits > 1 ? 's' : ''}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tool Form */}
          {selectedToolInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <selectedToolInfo.icon className="w-5 h-5" />
                  {selectedToolInfo.nameVi}
                </CardTitle>
                <CardDescription>
                  {selectedToolInfo.description} • Giá: {selectedToolInfo.credits} credit{selectedToolInfo.credits > 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Image Upload */}
                    <div>
                      <Label htmlFor="image-upload">Ảnh gốc *</Label>
                      <Input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="mt-1"
                        data-testid="input-image-upload"
                      />
                      {uploadImageMutation.isPending && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                          Đang tải ảnh...
                        </p>
                      )}
                    </div>

                    {/* Mask Upload (if needed) */}
                    {selectedToolInfo.needsMask && (
                      <div>
                        <Label htmlFor="mask-upload">Ảnh mask *</Label>
                        <Input
                          id="mask-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleMaskUpload}
                          className="mt-1"
                          data-testid="input-mask-upload"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Tải lên ảnh mask đen trắng để chỉ định vùng cần xử lý
                        </p>
                      </div>
                    )}

                    {/* Prompt (if needed) */}
                    {selectedToolInfo.needsPrompt && (
                      <FormField
                        control={form.control}
                        name="prompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mô tả (Prompt) *</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Nhập mô tả chi tiết..."
                                className="min-h-[80px]"
                                data-testid="input-prompt"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Background Prompt (if needed) */}
                    {selectedToolInfo.needsBackground && (
                      <FormField
                        control={form.control}
                        name="backgroundPrompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mô tả phông nền mới *</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Mô tả phông nền mới (VD: bãi biển, rừng xanh...)"
                                className="min-h-[60px]"
                                data-testid="input-background-prompt"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Extend Direction (if needed) */}
                    {selectedToolInfo.needsDirection && (
                      <FormField
                        control={form.control}
                        name="extendDirection"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hướng mở rộng</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-extend-direction">
                                  <SelectValue placeholder="Chọn hướng mở rộng" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="up">Lên trên</SelectItem>
                                <SelectItem value="down">Xuống dưới</SelectItem>
                                <SelectItem value="left">Sang trái</SelectItem>
                                <SelectItem value="right">Sang phải</SelectItem>
                                <SelectItem value="all">Tất cả hướng</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Upscale Method (if needed) */}
                    {selectedToolInfo.needsUpscale && (
                      <FormField
                        control={form.control}
                        name="upscaleMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mức độ tăng</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-upscale-method">
                                  <SelectValue placeholder="Chọn mức độ tăng" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="x2">2x (Gấp đôi)</SelectItem>
                                <SelectItem value="x4">4x (Gấp 4 lần)</SelectItem>
                                <SelectItem value="x8">8x (Gấp 8 lần)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={processToolMutation.isPending || uploadImageMutation.isPending || !selectedTool}
                      data-testid="button-process-tool"
                    >
                      {processToolMutation.isPending
                        ? "Đang xử lý..."
                        : `Xử lý với ${selectedToolInfo.nameVi} (${selectedToolInfo.credits} credit${selectedToolInfo.credits > 1 ? 's' : ''})`}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Preview and Results */}
        <div className="space-y-6">
          {/* Image Preview */}
          {imageUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Ảnh gốc</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={imageUrl}
                  alt="Uploaded image"
                  className="w-full h-auto rounded-lg border"
                  data-testid="preview-input-image"
                />
              </CardContent>
            </Card>
          )}

          {/* Mask Preview */}
          {maskDataUrl && selectedToolInfo?.needsMask && (
            <Card>
              <CardHeader>
                <CardTitle>Ảnh mask</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={maskDataUrl}
                  alt="Mask image"
                  className="w-full h-auto rounded-lg border"
                  data-testid="preview-mask-image"
                />
              </CardContent>
            </Card>
          )}

          {/* Recent Operations */}
          <Card>
            <CardHeader>
              <CardTitle>Lịch sử xử lý</CardTitle>
              <CardDescription>
                Các tác vụ xử lý gần đây của bạn
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {operations.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    Chưa có tác vụ nào
                  </p>
                ) : (
                  operations.map((operation: any) => {
                    const toolInfo = TOOLS.find(t => t.id === operation.toolType);
                    const statusColors = {
                      pending: "text-yellow-600 dark:text-yellow-400",
                      processing: "text-blue-600 dark:text-blue-400",
                      completed: "text-green-600 dark:text-green-400",
                      failed: "text-red-600 dark:text-red-400",
                    };

                    return (
                      <div
                        key={operation.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`operation-${operation.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {toolInfo && <toolInfo.icon className="w-5 h-5 text-blue-500" />}
                          <div>
                            <p className="font-medium">{toolInfo?.nameVi || operation.toolType}</p>
                            <p className="text-sm text-gray-500">{operation.fileName}</p>
                            <p className={`text-sm font-medium ${statusColors[operation.status as keyof typeof statusColors]}`}>
                              {operation.status === 'pending' && 'Đang chờ'}
                              {operation.status === 'processing' && 'Đang xử lý'}
                              {operation.status === 'completed' && 'Hoàn thành'}
                              {operation.status === 'failed' && 'Thất bại'}
                            </p>
                          </div>
                        </div>
                        {operation.status === 'completed' && operation.resultImageUrl && (
                          <Button
                            size="sm"
                            variant="outlined"
                            onClick={() => window.open(operation.resultImageUrl, '_blank')}
                            data-testid={`view-result-${operation.id}`}
                          >
                            Xem kết quả
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}