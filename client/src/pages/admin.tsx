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
import { Settings, Key, Plus, Eye, EyeOff, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { type ApiKey } from "@shared/schema";

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
  });

  // Veo3 API key setting form
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

  // Update Veo3 API key mutation
  const updateVeo3Mutation = useMutation({
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
        description: "Đã lưu Veo3 API Key mới",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể lưu Veo3 API Key",
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

  const onSubmitVeo3 = (data: { veo3ApiKey: string }) => {
    updateVeo3Mutation.mutate(data);
  };

  const onSubmitApiKey = (data: { name: string; apiKey: string }) => {
    addApiKeyMutation.mutate(data);
  };

  const toggleShowApiKey = (id: string) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskApiKey = (apiKey: string) => {
    return apiKey.slice(0, 8) + "*".repeat(Math.max(0, apiKey.length - 12)) + apiKey.slice(-4);
  };

  const getStatusBadge = (apiKey: ApiKey) => {
    if (!apiKey.isActive) {
      return <Badge variant="secondary" className="flex items-center gap-1"><XCircle className="w-3 h-3" />Tắt</Badge>;
    }
    if (apiKey.credits > 0) {
      return <Badge variant="default" className="flex items-center gap-1 bg-green-600"><CheckCircle className="w-3 h-3" />Hoạt động</Badge>;
    }
    return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="w-3 h-3" />Hết credit</Badge>;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Chưa kiểm tra";
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleString("vi-VN");
  };

  return (
    <div className="min-h-screen bg-dark-800 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Settings className="w-8 h-8 text-primary-500" />
            <div>
              <h1 className="text-3xl font-bold">Quản trị VEO3 API</h1>
              <p className="text-gray-400 mt-1">Quản lý API keys và kiểm tra credits tự động</p>
            </div>
          </div>
          <Button
            onClick={() => checkCreditsMutation.mutate()}
            disabled={checkCreditsMutation.isPending}
            className="bg-primary-600 hover:bg-primary-700"
            data-testid="button-check-all-credits"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checkCreditsMutation.isPending ? 'animate-spin' : ''}`} />
            Kiểm tra Credits
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Veo3 API Key Configuration */}
          <Card className="bg-dark-700 border-dark-600">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="w-5 h-5" />
                <span>Cấu hình Veo3 API Key</span>
              </CardTitle>
              <CardDescription>
                Thiết lập API Key chính để tạo video
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...veo3Form}>
                <form onSubmit={veo3Form.handleSubmit(onSubmitVeo3)} className="space-y-4">
                  <FormField
                    control={veo3Form.control}
                    name="veo3ApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Veo3 API Key</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Nhập Veo3 API Key..."
                            className="bg-dark-600 border-dark-500 text-white"
                            data-testid="input-veo3-api-key"
                          />
                        </FormControl>
                        <FormDescription>
                          API Key được sử dụng để kết nối với dịch vụ Veo3
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={updateVeo3Mutation.isPending}
                    className="w-full bg-primary-600 hover:bg-primary-700"
                    data-testid="button-save-veo3-key"
                  >
                    {updateVeo3Mutation.isPending ? "Đang lưu..." : "Lưu API Key"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Add New API Key */}
          <Card className="bg-dark-700 border-dark-600">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Plus className="w-5 h-5" />
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
                            className="bg-dark-600 border-dark-500 text-white"
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
                            className="bg-dark-600 border-dark-500 text-white"
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

        {/* API Keys List */}
        <Card className="bg-dark-700 border-dark-600">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Danh sách API Keys</CardTitle>
                <CardDescription>
                  Quản lý tất cả API Keys với theo dõi credits tự động
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-primary-400 border-primary-600">
                {apiKeys.filter((k: ApiKey) => k.isActive && k.credits > 0).length} / {apiKeys.length} keys khả dụng
              </Badge>
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
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
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
                            variant="outline"
                            size="sm"
                            onClick={() => deleteApiKeyMutation.mutate(apiKey.id)}
                            disabled={deleteApiKeyMutation.isPending}
                            className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                            data-testid={`button-delete-${apiKey.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>
    </div>
  );
}