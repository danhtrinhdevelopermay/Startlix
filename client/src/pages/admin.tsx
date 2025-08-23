import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SettingsRegular, KeyRegular, AddRegular, EyeRegular, EyeOffRegular, DeleteRegular, ArrowClockwiseRegular, CheckmarkCircleRegular, DismissCircleRegular, ErrorCircleRegular } from "@fluentui/react-icons";
import { type ApiKey, type ExternalApiKey } from "@shared/schema";
import { MD3ButtonLoading } from "@/components/md3-loading-indicator";

export default function Admin() {
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  
  // Get settings
  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/settings"],
  });

  // Get API keys
  const { data: apiKeys = [] } = useQuery<ApiKey[]>({
    queryKey: ["/api/admin/api-keys"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Get API keys summary
  const { data: summary } = useQuery<any>({
    queryKey: ["/api/admin/api-keys-summary"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get external API keys
  const { data: externalApiKeys = [] } = useQuery<ExternalApiKey[]>({
    queryKey: ["/api/admin/external-api-keys"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Get PhotAI API keys
  const { data: photaiKeys = [] } = useQuery<ExternalApiKey[]>({
    queryKey: ["/api/admin/photai-api-keys"],
    refetchInterval: 60000, // Refresh every minute
  });

  // STLix API key setting form
  const veo3Form = useForm({
    defaultValues: {
      veo3ApiKey: Array.isArray(settings) ? settings?.find((s: any) => s.key === "VEO3_API_KEY")?.value || "" : "",
    },
  });

  // API key form
  const apiKeyForm = useForm({
    defaultValues: {
      name: "",
      apiKey: "",
    },
  });

  // Segmind test form
  const segmindTestForm = useForm({
    defaultValues: {
      videoUrl: "",
    },
  });

  // External API key form
  const externalApiKeyForm = useForm({
    defaultValues: {
      keyName: "",
      creditsLimit: "100",
      userId: "",
    },
  });

  // PhotAI API key form
  const photaiApiKeyForm = useForm({
    defaultValues: {
      keyName: "",
      apiKey: "",
      creditsLimit: "100",
    },
  });

  // Update STLix API key mutation
  const updateSTLixMutation = useMutation({
    mutationFn: async (data: { veo3ApiKey: string }) => {
      await apiRequest("POST", "/api/admin/settings", {
        key: "VEO3_API_KEY",
        value: data.veo3ApiKey,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Cập nhật thành công",
        description: "Đã lưu STLix API Key mới",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể lưu STLix API Key",
        variant: "destructive",
      });
    },
  });

  // Add API key mutation
  const addApiKeyMutation = useMutation({
    mutationFn: async (data: { name: string; apiKey: string }) => {
      await apiRequest("POST", "/api/admin/api-keys", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      apiKeyForm.reset();
      toast({
        title: "Thêm thành công",
        description: "Đã thêm API Key mới",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể thêm API Key",
        variant: "destructive",
      });
    },
  });

  // Delete API key mutation
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({
        title: "Xóa thành công",
        description: "Đã xóa API Key",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa API Key",
        variant: "destructive",
      });
    },
  });

  // Toggle API key status mutation
  const toggleApiKeyMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PUT", `/api/admin/api-keys/${id}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({
        title: "Cập nhật thành công",
        description: "Đã thay đổi trạng thái API Key",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật API Key",
        variant: "destructive",
      });
    },
  });

  // Check credits for all API keys
  const checkCreditsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/check-credits");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({
        title: "Kiểm tra hoàn tất",
        description: "Đã cập nhật credits cho tất cả API keys",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể kiểm tra credits",
        variant: "destructive",
      });
    },
  });

  // Test Segmind API mutation
  const testSegmindMutation = useMutation({
    mutationFn: async (data: { videoUrl: string }) => {
      const response = await apiRequest("POST", "/api/admin/test-segmind", data);
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Test thành công",
        description: data.enhancedVideoUrl ? "Video đã được nâng cao chất lượng!" : "API hoạt động nhưng không có video output",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test thất bại",
        description: error.error || error.message || "Lỗi không xác định",
        variant: "destructive",
      });
    },
  });

  // Toggle STLix Premium model mutation
  const toggleSTLixPremiumMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest("POST", "/api/admin/settings", {
        key: "VEO3_PREMIUM_ENABLED",
        value: enabled ? "true" : "false",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/model-status/veo3-premium"] });
      toast({
        title: "Cập nhật thành công",
        description: "Đã thay đổi trạng thái mô hình STLix Cao Cấp",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái mô hình",
        variant: "destructive",
      });
    },
  });

  // Create PhotAI API key mutation
  const createPhotaiApiKeyMutation = useMutation({
    mutationFn: async (data: { keyName: string; apiKey: string; creditsLimit: number }) => {
      return apiRequest("/api/admin/photai-api-keys", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photai-api-keys"] });
      photaiApiKeyForm.reset();
      toast({
        title: "✅ Thành công",
        description: "Đã thêm PhotAI API key mới",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Lỗi",
        description: error.message || "Không thể thêm PhotAI API key",
        variant: "destructive",
      });
    },
  });

  // Toggle PhotAI API key mutation
  const togglePhotaiApiKeyMutation = useMutation({
    mutationFn: async (data: { id: string; isActive: boolean }) => {
      return apiRequest("/api/admin/photai-api-keys/" + data.id, {
        method: "PATCH",
        body: JSON.stringify({ isActive: data.isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photai-api-keys"] });
      toast({
        title: "✅ Thành công",
        description: "Đã cập nhật trạng thái PhotAI API key",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Lỗi",
        description: error.message || "Không thể cập nhật PhotAI API key",
        variant: "destructive",
      });
    },
  });

  // Delete PhotAI API key mutation
  const deletePhotaiApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("/api/admin/photai-api-keys/" + id, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photai-api-keys"] });
      toast({
        title: "✅ Thành công",
        description: "Đã xóa PhotAI API key",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Lỗi",
        description: error.message || "Không thể xóa PhotAI API key",
        variant: "destructive",
      });
    },
  });

  const onSubmitSTLix = (data: { veo3ApiKey: string }) => {
    updateSTLixMutation.mutate(data);
  };

  const onSubmitApiKey = (data: { name: string; apiKey: string }) => {
    addApiKeyMutation.mutate(data);
  };

  const onSubmitSegmindTest = (data: { videoUrl: string }) => {
    testSegmindMutation.mutate(data);
  };

  const onSubmitPhotaiApiKey = (data: { keyName: string; apiKey: string; creditsLimit: string }) => {
    createPhotaiApiKeyMutation.mutate({
      keyName: data.keyName,
      apiKey: data.apiKey,
      creditsLimit: Number(data.creditsLimit) || 100,
    });
  };

  const toggleShowApiKey = (id: string) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskApiKey = (apiKey: string) => {
    return apiKey.slice(0, 8) + "*".repeat(Math.max(0, apiKey.length - 12)) + apiKey.slice(-4);
  };

  const getStatusBadge = (apiKey: ApiKey) => {
    if (!apiKey.isActive) {
      return <Badge variant="secondary" className="flex items-center gap-1"><DismissCircleRegular className="w-3 h-3" />Tắt</Badge>;
    }
    if (apiKey.credits > 0) {
      return <Badge variant="default" className="flex items-center gap-1 bg-green-600"><CheckmarkCircleRegular className="w-3 h-3" />Hoạt động</Badge>;
    }
    return <Badge variant="destructive" className="flex items-center gap-1"><ErrorCircleRegular className="w-3 h-3" />Hết credit</Badge>;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Chưa kiểm tra";
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleString("vi-VN");
  };

  return (
    <div className="min-h-screen text-[var(--fluent-neutral-foreground-1)] p-6 relative z-10">
      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <SettingsRegular className="w-8 h-8 text-primary-500" />
            <div>
              <h1 className="text-3xl font-bold">Quản trị STLIX API</h1>
              <p className="text-gray-400 mt-1">Quản lý API keys và kiểm tra credits tự động</p>
            </div>
          </div>
          <Button
            onClick={() => checkCreditsMutation.mutate()}
            disabled={checkCreditsMutation.isPending}
            className="fluent-button-primary"
            data-testid="button-check-all-credits"
          >
            {checkCreditsMutation.isPending ? (
              <MD3ButtonLoading 
                label="Checking credits" 
                data-testid="loading-check-credits"
              />
            ) : (
              <ArrowClockwiseRegular className="w-4 h-4 mr-2" />
            )}
            Kiểm tra Credits
          </Button>
        </div>

        {/* System Status */}
        <Card className="fluent-glass-strong">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckmarkCircleRegular className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Hệ thống Load Balancing hoạt động</h3>
                  <p className="text-sm text-gray-300">
                    Round-robin tự động giữa {summary?.activeKeys || apiKeys.filter((k: ApiKey) => k.isActive && k.credits > 0).length} API keys khả dụng
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Tự động refresh credits mỗi 2 phút • Cache credits 5 phút
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-300">Kiểm tra cuối:</div>
                <div className="text-xs text-gray-400">
                  {summary?.lastChecked ? new Date(summary.lastChecked).toLocaleString("vi-VN") : "Chưa có dữ liệu"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="fluent-glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Tổng API Keys</p>
                  <p className="text-2xl font-bold" data-testid="stat-total-keys">
                    {summary?.totalKeys || apiKeys.length}
                  </p>
                </div>
                <KeyRegular className="w-8 h-8 text-primary-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="fluent-glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Keys hoạt động</p>
                  <p className="text-2xl font-bold text-green-400" data-testid="stat-active-keys">
                    {summary?.activeKeys || apiKeys.filter((k: ApiKey) => k.isActive && k.credits > 0).length}
                  </p>
                </div>
                <CheckmarkCircleRegular className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="fluent-glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Tổng Credits</p>
                  <p className="text-2xl font-bold text-blue-400" data-testid="stat-total-credits">
                    {(summary?.totalCredits || apiKeys.reduce((sum: number, k: ApiKey) => sum + k.credits, 0)).toLocaleString()}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  C
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="fluent-glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Keys hết credit</p>
                  <p className="text-2xl font-bold text-red-400" data-testid="stat-empty-keys">
                    {summary?.emptyKeys || apiKeys.filter((k: ApiKey) => k.credits === 0).length}
                  </p>
                </div>
                <ErrorCircleRegular className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Key with Most Credits */}
        {apiKeys.length > 0 && apiKeys.some((k: ApiKey) => k.credits > 0) && (
          <Card className="fluent-glass">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                  <span className="text-xs font-bold text-black">★</span>
                </div>
                <span>API Key nhiều credits nhất</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const topApiKey = apiKeys.reduce((max: ApiKey | null, current: ApiKey) => 
                  (!max || current.credits > max.credits) ? current : max, null);
                
                return topApiKey ? (
                  <div className="flex items-center justify-between p-4 bg-dark-600 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <p className="font-semibold">{topApiKey.name}</p>
                          <p className="text-sm text-gray-400">
                            Kiểm tra lần cuối: {formatDate(topApiKey.lastChecked)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-400">
                        {topApiKey.credits.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-400">credits</p>
                    </div>
                  </div>
                ) : null;
              })()}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* STLix API Key Configuration */}
          <Card className="fluent-glass">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <KeyRegular className="w-5 h-5" />
                <span>Cấu hình STLix API Key</span>
              </CardTitle>
              <CardDescription>
                Thiết lập API Key chính để tạo video
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...veo3Form}>
                <form onSubmit={veo3Form.handleSubmit(onSubmitSTLix)} className="space-y-4">
                  <FormField
                    control={veo3Form.control}
                    name="veo3ApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>STLix API Key</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Nhập STLix API Key..."
                            className="fluent-glass-subtle text-[var(--fluent-neutral-foreground-1)]"
                            data-testid="input-veo3-api-key"
                          />
                        </FormControl>
                        <FormDescription>
                          API Key được sử dụng để kết nối với dịch vụ STLix
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={updateSTLixMutation.isPending}
                    className="w-full bg-primary-600 hover:bg-primary-700"
                    data-testid="button-save-veo3-key"
                  >
                    {updateSTLixMutation.isPending ? "Đang lưu..." : "Lưu API Key"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Add New API Key */}
          <Card className="fluent-glass">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AddRegular className="w-5 h-5" />
                <span>Thêm API Key</span>
              </CardTitle>
              <CardDescription>
                Thêm API Key dự phòng cho hệ thống
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...apiKeyForm}>
                <form onSubmit={apiKeyForm.handleSubmit(onSubmitApiKey)} className="space-y-4">
                  <FormField
                    control={apiKeyForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tên API Key</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ví dụ: Backup Key 1"
                            className="fluent-glass-subtle text-[var(--fluent-neutral-foreground-1)]"
                            data-testid="input-api-key-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={apiKeyForm.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Nhập API Key..."
                            className="fluent-glass-subtle text-[var(--fluent-neutral-foreground-1)]"
                            data-testid="input-new-api-key"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={addApiKeyMutation.isPending}
                    className="w-full bg-green-600 hover:bg-green-700"
                    data-testid="button-add-api-key"
                  >
                    {addApiKeyMutation.isPending ? "Đang thêm..." : "Thêm API Key"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* STLix Premium Model Control */}
        <Card className="fluent-glass-strong border-primary-600">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">V3</span>
                </div>
                <div>
                  <CardTitle className="text-lg">Quản lý Mô hình STLix Cao Cấp</CardTitle>
                  <CardDescription>
                    Bật/tắt mô hình STLix Cao Cấp cho người dùng
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm text-gray-400">Trạng thái</div>
                  <div className={`text-sm font-medium ${
                    settings?.find((s: any) => s.key === "VEO3_PREMIUM_ENABLED")?.value === "true" 
                      ? "text-green-400" 
                      : "text-red-400"
                  }`}>
                    {settings?.find((s: any) => s.key === "VEO3_PREMIUM_ENABLED")?.value === "true" 
                      ? "Hoạt động" 
                      : "Bảo trì"}
                  </div>
                </div>
                <Switch
                  checked={settings?.find((s: any) => s.key === "VEO3_PREMIUM_ENABLED")?.value === "true"}
                  onCheckedChange={(checked) => toggleSTLixPremiumMutation.mutate(checked)}
                  disabled={toggleSTLixPremiumMutation.isPending}
                  data-testid="switch-veo3-premium"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-dark-600 rounded-lg border border-dark-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-green-400 mb-2">Khi BẬT:</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Người dùng có thể chọn mô hình STLix Cao Cấp</li>
                      <li>• Mô hình hoạt động bình thường</li>
                      <li>• Tạo video chất lượng cao nhất</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-red-400 mb-2">Khi TẮT:</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Mô hình bị vô hiệu hóa</li>
                      <li>• Hiển thị thông báo bảo trì</li>
                      <li>• Người dùng phải chọn mô hình khác</li>
                    </ul>
                  </div>
                </div>
              </div>
              {settings?.find((s: any) => s.key === "VEO3_PREMIUM_ENABLED")?.value !== "true" && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <ErrorCircleRegular className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-300">
                      Mô hình STLix Cao Cấp hiện đang ở chế độ bảo trì
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* API Keys List */}
        <Card className="fluent-glass-strong">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <span>Danh sách API Keys</span>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </CardTitle>
                <CardDescription>
                  Quản lý tất cả API Keys với Load Balancing và theo dõi credits tự động
                </CardDescription>
              </div>
              <div className="text-right space-y-1">
                <Badge variant="outline" className="text-primary-400 border-primary-600">
                  {summary?.activeKeys || apiKeys.filter((k: ApiKey) => k.isActive && k.credits > 0).length} / {summary?.totalKeys || apiKeys.length} keys khả dụng
                </Badge>
                <div className="text-xs text-gray-400">
                  Round-robin load balancing
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!Array.isArray(apiKeys) || apiKeys.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                Chưa có API Key nào. Thêm API key đầu tiên để bắt đầu.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-dark-600">
                    <TableHead>Tên</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Kiểm tra lần cuối</TableHead>
                    <TableHead>Tạo lúc</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((apiKey: ApiKey) => (
                    <TableRow key={apiKey.id} className="border-dark-600">
                      <TableCell className="font-medium">{apiKey.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center space-x-2">
                          <code className="bg-dark-500 px-2 py-1 rounded text-xs">
                            {showApiKey[apiKey.id] ? apiKey.apiKey : maskApiKey(apiKey.apiKey)}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleShowApiKey(apiKey.id)}
                            className="p-1 h-6 w-6"
                            data-testid={`button-toggle-show-${apiKey.id}`}
                          >
                            {showApiKey[apiKey.id] ? (
                              <EyeOffRegular className="w-3 h-3" />
                            ) : (
                              <EyeRegular className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={apiKey.credits > 0 ? "text-green-400 font-medium" : "text-red-400"}>
                          {apiKey.credits.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(apiKey)}</TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {formatDate(apiKey.lastChecked)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {formatDate(apiKey.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={apiKey.isActive}
                            onCheckedChange={(checked) => toggleApiKeyMutation.mutate({ id: apiKey.id, isActive: checked })}
                            disabled={toggleApiKeyMutation.isPending}
                            data-testid={`switch-${apiKey.id}`}
                          />
                          <Button
                            variant="outlined"
                            size="sm"
                            onClick={() => deleteApiKeyMutation.mutate(apiKey.id)}
                            disabled={deleteApiKeyMutation.isPending}
                            className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                            data-testid={`button-delete-${apiKey.id}`}
                          >
                            <DeleteRegular className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Segmind API Test */}
        <Card className="bg-dark-700 border-dark-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ErrorCircleRegular className="w-5 h-5 text-blue-400" />
              Test FFmpeg Enhancement
            </CardTitle>
            <CardDescription>
              Kiểm tra tính năng nâng cao chất lượng video bằng FFmpeg (miễn phí, local processing)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...segmindTestForm}>
              <form onSubmit={segmindTestForm.handleSubmit(onSubmitSegmindTest)} className="space-y-4">
                <FormField
                  control={segmindTestForm.control}
                  name="videoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL Video để test</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://example.com/video.mp4"
                          className="bg-dark-600 border-dark-500"
                          data-testid="input-segmind-video-url"
                        />
                      </FormControl>
                      <FormDescription className="text-gray-400">
                        Nhập URL video hợp lệ để test khả năng nâng cao chất lượng qua FFmpeg
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={testSegmindMutation.isPending}
                  className="fluent-button-primary"
                  data-testid="button-test-segmind"
                >
                  {testSegmindMutation.isPending ? (
                    <MD3ButtonLoading 
                      label="Testing FFmpeg Enhancement" 
                      data-testid="loading-test-ffmpeg"
                    />
                  ) : (
                    <>
                      <CheckmarkCircleRegular className="w-4 h-4 mr-2" />
                      Test FFmpeg Enhancement
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {/* Test Result Display */}
            {testSegmindMutation.data && (
              <div className="mt-6 p-4 border border-green-600 rounded-lg bg-green-900/20">
                <h4 className="text-green-400 font-medium mb-2">✅ Test thành công!</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Video gốc:</span>
                    <code className="ml-2 text-blue-400">{(testSegmindMutation.data as any)?.originalVideoUrl}</code>
                  </div>
                  {(testSegmindMutation.data as any)?.enhancedVideoUrl && (
                    <div>
                      <span className="text-gray-400">Video nâng cao:</span>
                      <code className="ml-2 text-green-400">{(testSegmindMutation.data as any)?.enhancedVideoUrl}</code>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400">Thời gian:</span>
                    <span className="ml-2">{new Date((testSegmindMutation.data as any)?.timestamp || Date.now()).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Test Error Display */}
            {testSegmindMutation.error && (
              <div className="mt-6 p-4 border border-red-600 rounded-lg bg-red-900/20">
                <h4 className="text-red-400 font-medium mb-2">❌ Test thất bại</h4>
                <div className="text-sm">
                  <span className="text-gray-400">Lỗi:</span>
                  <code className="ml-2 text-red-400">{(testSegmindMutation.error as any)?.error || (testSegmindMutation.error as any)?.message || 'Lỗi không xác định'}</code>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Settings */}
        <Card className="bg-dark-700 border-dark-600">
          <CardHeader>
            <CardTitle>Cài đặt hiện tại</CardTitle>
            <CardDescription>
              Xem tất cả cài đặt hệ thống
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!Array.isArray(settings) || settings.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Chưa có cài đặt nào</p>
            ) : (
              <div className="space-y-3">
                {settings.map((setting: any) => (
                  <div
                    key={setting.id}
                    className="flex justify-between items-center p-3 bg-dark-600 rounded border border-dark-500"
                    data-testid={`setting-${setting.key}`}
                  >
                    <div>
                      <code className="text-sm font-medium">{setting.key}</code>
                      <div className="text-xs text-gray-400">
                        Cập nhật: {new Date(setting.updatedAt).toLocaleString('vi-VN')}
                      </div>
                    </div>
                    <code className="text-sm bg-dark-500 px-2 py-1 rounded">
                      {setting.key.includes('KEY') ? maskApiKey(setting.value) : setting.value}
                    </code>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* External API Keys Management */}
        <Card className="bg-dark-700 border-dark-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRegular className="h-5 w-5" />
              External API Keys
            </CardTitle>
            <CardDescription>
              Quản lý API keys cho người dùng bên ngoài
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Create External API Key Form */}
            <Form {...externalApiKeyForm}>
              <form
                onSubmit={externalApiKeyForm.handleSubmit(async (data) => {
                  try {
                    await apiRequest("POST", "/api/admin/external-api-keys", {
                      keyName: data.keyName,
                      creditsLimit: Number(data.creditsLimit),
                      userId: data.userId || null,
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/admin/external-api-keys"] });
                    externalApiKeyForm.reset();
                    toast({
                      title: "Thành công",
                      description: "Đã tạo External API Key mới",
                    });
                  } catch (error: any) {
                    toast({
                      title: "Lỗi",
                      description: error.message || "Không thể tạo External API Key",
                      variant: "destructive",
                    });
                  }
                })}
                className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
              >
                <FormField
                  control={externalApiKeyForm.control}
                  name="keyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tên API Key</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Tên mô tả cho API key"
                          data-testid="input-external-key-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={externalApiKeyForm.control}
                  name="creditsLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Giới hạn Credits</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="100"
                          data-testid="input-credits-limit"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={externalApiKeyForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User ID (tuỳ chọn)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="ID người dùng"
                          data-testid="input-user-id"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-create-external-key"
                >
                  <AddRegular className="h-4 w-4 mr-2" />
                  Tạo API Key
                </Button>
              </form>
            </Form>

            <Separator />

            {/* External API Keys Table */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Danh sách External API Keys</h3>
              {externalApiKeys.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Chưa có External API Key nào</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên</TableHead>
                        <TableHead>API Key</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Sử dụng gần đây</TableHead>
                        <TableHead>Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {externalApiKeys.map((key) => (
                        <TableRow key={key.id} data-testid={`external-key-${key.id}`}>
                          <TableCell className="font-medium">{key.keyName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-sm bg-dark-600 px-2 py-1 rounded">
                                {showApiKey[key.id] ? key.apiKey : `${key.apiKey.slice(0, 12)}...${key.apiKey.slice(-4)}`}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowApiKey({ ...showApiKey, [key.id]: !showApiKey[key.id] })}
                                data-testid={`button-toggle-key-${key.id}`}
                              >
                                {showApiKey[key.id] ? <EyeOffRegular className="h-4 w-4" /> : <EyeRegular className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={key.isActive ? "default" : "secondary"}>
                              {key.isActive ? "Hoạt động" : "Tạm dừng"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{key.creditsUsed} / {key.creditsLimit}</div>
                              <div className="text-gray-400">
                                {key.creditsLimit - key.creditsUsed} còn lại
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-400">
                              {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString('vi-VN') : 'Chưa sử dụng'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await apiRequest("PATCH", `/api/admin/external-api-keys/${key.id}`, {
                                      isActive: !key.isActive
                                    });
                                    queryClient.invalidateQueries({ queryKey: ["/api/admin/external-api-keys"] });
                                    toast({
                                      title: "Thành công",
                                      description: `Đã ${key.isActive ? 'tạm dừng' : 'kích hoạt'} API key`,
                                    });
                                  } catch (error: any) {
                                    toast({
                                      title: "Lỗi",
                                      description: error.message || "Không thể cập nhật API key",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                data-testid={`button-toggle-status-${key.id}`}
                              >
                                {key.isActive ? (
                                  <DismissCircleRegular className="h-4 w-4 text-orange-400" />
                                ) : (
                                  <CheckmarkCircleRegular className="h-4 w-4 text-green-400" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await apiRequest("POST", `/api/admin/external-api-keys/${key.id}/reset-usage`, {});
                                    queryClient.invalidateQueries({ queryKey: ["/api/admin/external-api-keys"] });
                                    toast({
                                      title: "Thành công",
                                      description: "Đã reset usage cho API key",
                                    });
                                  } catch (error: any) {
                                    toast({
                                      title: "Lỗi",
                                      description: error.message || "Không thể reset usage",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                data-testid={`button-reset-usage-${key.id}`}
                              >
                                <ArrowClockwiseRegular className="h-4 w-4 text-blue-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PhotAI API Keys Management */}
        <Card className="bg-dark-700 border-dark-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRegular className="w-5 h-5 text-purple-400" />
              Quản lý PhotAI API Keys
            </CardTitle>
            <CardDescription>
              Thêm và quản lý nhiều PhotAI API keys cho tính năng thay thế đối tượng. Hệ thống sẽ tự động chọn key khả dụng.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Add new PhotAI API key form */}
            <Form {...photaiApiKeyForm}>
              <form onSubmit={photaiApiKeyForm.handleSubmit(onSubmitPhotaiApiKey)} className="space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={photaiApiKeyForm.control}
                    name="keyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tên Key</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="My PhotAI Key"
                            className="bg-dark-600 border-dark-500"
                            data-testid="input-photai-key-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={photaiApiKeyForm.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PhotAI API Key</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="68a9325d0591f3b3f3563aba_..."
                            className="bg-dark-600 border-dark-500"
                            data-testid="input-photai-api-key"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={photaiApiKeyForm.control}
                    name="creditsLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Giới hạn Credits</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="100"
                            className="bg-dark-600 border-dark-500"
                            data-testid="input-photai-credits-limit"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={createPhotaiApiKeyMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                  data-testid="button-add-photai-key"
                >
                  {createPhotaiApiKeyMutation.isPending ? (
                    <MD3ButtonLoading 
                      label="Adding PhotAI Key" 
                      data-testid="loading-add-photai-key"
                    />
                  ) : (
                    <>
                      <AddRegular className="h-4 w-4 mr-2" />
                      Thêm PhotAI Key
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {/* PhotAI API keys list */}
            {photaiKeys.length === 0 ? (
              <div className="text-center py-8">
                <KeyRegular className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">Chưa có PhotAI API key nào</p>
                <p className="text-sm text-gray-500 mt-2">
                  Thêm PhotAI API key để hệ thống có thể sử dụng tính năng thay thế đối tượng
                </p>
              </div>
            ) : (
              <Table className="bg-dark-800 border-dark-600">
                <TableHeader>
                  <TableRow className="border-dark-600">
                    <TableHead>Tên Key</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Lần cuối sử dụng</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {photaiKeys.filter(key => key.keyName.startsWith('[PhotAI]')).map((key) => (
                    <TableRow key={key.id} data-testid={`photai-key-${key.id}`} className="border-dark-600">
                      <TableCell className="font-medium">
                        {key.keyName.replace('[PhotAI] ', '')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-dark-600 px-2 py-1 rounded">
                            {showApiKey[key.id] ? key.apiKey : `${key.apiKey.slice(0, 12)}...${key.apiKey.slice(-4)}`}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowApiKey({ ...showApiKey, [key.id]: !showApiKey[key.id] })}
                            data-testid={`button-toggle-photai-key-${key.id}`}
                          >
                            {showApiKey[key.id] ? <EyeOffRegular className="h-4 w-4" /> : <EyeRegular className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={key.isActive ? "default" : "secondary"} className={key.isActive ? "bg-purple-600" : ""}>
                          {key.isActive ? "Hoạt động" : "Tạm dừng"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{key.creditsUsed} / {key.creditsLimit}</div>
                          <div className="text-gray-400">
                            {key.creditsLimit - key.creditsUsed} còn lại
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-400">
                          {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString('vi-VN') : 'Chưa sử dụng'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={key.isActive}
                            onCheckedChange={(checked) => togglePhotaiApiKeyMutation.mutate({ id: key.id, isActive: checked })}
                            disabled={togglePhotaiApiKeyMutation.isPending}
                            data-testid={`switch-photai-${key.id}`}
                          />
                          <Button
                            variant="outlined"
                            size="sm"
                            onClick={() => deletePhotaiApiKeyMutation.mutate(key.id)}
                            disabled={deletePhotaiApiKeyMutation.isPending}
                            className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                            data-testid={`button-delete-photai-${key.id}`}
                          >
                            <DeleteRegular className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}