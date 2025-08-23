import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { ArrowUploadRegular, ImageRegular, EditRegular, PersonRegular, SignOutRegular, SparkleRegular, LinkRegular } from "@fluentui/react-icons";
import { Link } from "wouter";
import { MD3ButtonLoading } from "@/components/md3-loading-indicator";
import CreditBalance from "@/components/credit-balance";

const objectReplacementSchema = z.object({
  fileName: z.string().min(1, "Tên file không được để trống"),
  inputImageUrl: z.string().url("URL ảnh không hợp lệ"), 
  maskImageBase64: z.string().min(1, "Mask image không được để trống"),
});

type ObjectReplacementForm = z.infer<typeof objectReplacementSchema>;

interface ObjectReplacement {
  id: string;
  userId: string;
  fileName: string;
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
  const [maskImageFile, setMaskImageFile] = useState<File | null>(null);
  const [inputImagePreview, setInputImagePreview] = useState<string>("");
  const [maskImagePreview, setMaskImagePreview] = useState<string>("");
  const [inputImageUrl, setInputImageUrl] = useState<string>("");
  const inputFileRef = useRef<HTMLInputElement>(null);
  const maskFileRef = useRef<HTMLInputElement>(null);

  const form = useForm<ObjectReplacementForm>({
    resolver: zodResolver(objectReplacementSchema),
    defaultValues: {
      fileName: "",
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
        setInputImageUrl(data.imageUrl);
        form.setValue("inputImageUrl", data.imageUrl);
        form.setValue("fileName", file.name);
        toast({
          title: "✅ Tải ảnh thành công",
          description: "Ảnh gốc đã được tải lên",
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
      const response = await apiRequest("POST", "/api/object-replacement", data);
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/object-replacements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({
        title: "✅ Thay thế đối tượng thành công",
        description: `Đã hoàn thành! Sử dụng ${data.creditsUsed} credits.`,
      });
      // Reset form after successful replacement
      form.reset();
      setInputImageFile(null);
      setMaskImageFile(null);
      setInputImagePreview("");
      setMaskImagePreview("");
      setInputImageUrl("");
    },
    onError: (error: any) => {
      toast({
        title: "❌ Lỗi thay thế đối tượng",
        description: error.message || "Không thể thay thế đối tượng",
        variant: "destructive",
      });
    },
  });

  const handleInputImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setInputImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setInputImagePreview(previewUrl);
      uploadImageMutation.mutate(file);
    }
  };

  const handleMaskImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setMaskImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setMaskImagePreview(base64);
        form.setValue("maskImageBase64", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (data: ObjectReplacementForm) => {
    if (!inputImageFile || !maskImageFile) {
      toast({
        title: "❌ Thiếu ảnh",
        description: "Vui lòng tải lên cả ảnh gốc và ảnh mask",
        variant: "destructive",
      });
      return;
    }
    
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
          {/* Upload and Configuration */}
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

                    {/* Mask Image Upload */}
                    <div className="space-y-4">
                      <FormLabel>Ảnh mask (vùng cần thay thế)</FormLabel>
                      <FormDescription>
                        Tải lên ảnh mask màu trắng để chỉ định vùng cần thay thế. Vùng màu trắng sẽ được thay thế bằng nội dung mới.
                      </FormDescription>
                      <div
                        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition-colors"
                        onClick={() => maskFileRef.current?.click()}
                        data-testid="upload-mask-image"
                      >
                        {maskImagePreview ? (
                          <div className="space-y-2">
                            <img
                              src={maskImagePreview}
                              alt="Mask preview"
                              className="max-h-48 mx-auto rounded-lg"
                            />
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {maskImageFile?.name}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <ArrowUploadRegular className="w-12 h-12 text-gray-400 mx-auto" />
                            <p className="text-gray-600 dark:text-gray-400">
                              Nhấp để tải lên ảnh mask
                            </p>
                          </div>
                        )}
                      </div>
                      <input
                        ref={maskFileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleMaskImageUpload}
                        className="hidden"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={objectReplacementMutation.isPending || uploadImageMutation.isPending}
                      data-testid="button-replace-object"
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