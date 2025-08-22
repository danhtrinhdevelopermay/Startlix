import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { LinkRegular, CopyRegular, CheckmarkCircleRegular, ClockRegular, MoneyRegular } from '@fluentui/react-icons';

const createLinkSchema = z.object({
  targetUrl: z.string().url("Vui lòng nhập URL hợp lệ"),
  rewardAmount: z.number().min(1).max(10).default(1),
});

type CreateLinkForm = z.infer<typeof createLinkSchema>;

interface RewardLink {
  id: string;
  userId: string;
  targetUrl: string;
  bypassUrl: string;
  rewardAmount: number;
  isUsed: boolean;
  createdAt: string;
  usedAt: string | null;
}

export default function RewardLinksPage() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  // Form setup
  const form = useForm<CreateLinkForm>({
    resolver: zodResolver(createLinkSchema),
    defaultValues: {
      targetUrl: '',
      rewardAmount: 1,
    },
  });

  // Fetch user's reward links
  const { data: rewardLinks = [], isLoading: linksLoading, refetch } = useQuery<RewardLink[]>({
    queryKey: ['/api/reward-links'],
  });

  // Create reward link mutation
  const createLinkMutation = useMutation({
    mutationFn: async (data: CreateLinkForm) => {
      return await apiRequest('POST', '/api/create-reward-link', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reward-links'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
      form.reset();
      setIsCreating(false);
      toast({
        title: "Thành công!",
        description: "Đã tạo link vượt thành công",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo link vượt",
        variant: "destructive",
      });
    },
  });

  const handleCreateLink = (data: CreateLinkForm) => {
    createLinkMutation.mutate(data);
  };

  const copyToClipboard = async (text: string, linkType: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Đã copy!",
        description: `Đã copy ${linkType} vào clipboard`,
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể copy vào clipboard",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  if (linksLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải reward links...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center gap-3">
          <LinkRegular className="w-8 h-8 text-blue-500" />
          Link Vượt - Kiếm Credit
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Tạo link vượt để kiếm thêm credit. Khi ai đó vượt link của bạn và mở link đích, bạn sẽ nhận được credit!
        </p>
      </div>

      {/* Create Link Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MoneyRegular className="h-5 w-5" />
            Tạo Link Vượt Mới
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isCreating ? (
            <Button 
              onClick={() => setIsCreating(true)}
              className="w-full"
              data-testid="button-create-link"
            >
              <LinkRegular className="w-4 h-4 mr-2" />
              Tạo Link Vượt
            </Button>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateLink)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="targetUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL Đích</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://example.com"
                          data-testid="input-target-url"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rewardAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Số Credit Thưởng (1-10)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={10}
                          value={field.value}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          data-testid="input-reward-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    disabled={createLinkMutation.isPending}
                    data-testid="button-submit-create"
                  >
                    {createLinkMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    ) : (
                      <LinkRegular className="w-4 h-4 mr-2" />
                    )}
                    Tạo Link
                  </Button>
                  <Button 
                    type="button" 
                    variant="outlined" 
                    onClick={() => {
                      setIsCreating(false);
                      form.reset();
                    }}
                    data-testid="button-cancel-create"
                  >
                    Hủy
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      {/* Links List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">Danh Sách Link Vượt Của Bạn</h2>
        
        {rewardLinks.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <LinkRegular className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Chưa có link nào</h3>
              <p className="text-gray-600">Tạo link vượt đầu tiên để bắt đầu kiếm credit!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {rewardLinks.map((link) => (
              <Card key={link.id} className="relative">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={link.isUsed ? "secondary" : "default"}>
                          {link.isUsed ? (
                            <>
                              <CheckmarkCircleRegular className="w-3 h-3 mr-1" />
                              Đã Sử Dụng
                            </>
                          ) : (
                            <>
                              <ClockRegular className="w-3 h-3 mr-1" />
                              Chờ Sử Dụng
                            </>
                          )}
                        </Badge>
                        <Badge variant="outline">
                          {link.rewardAmount} Credit
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Link đích:</strong> {link.targetUrl}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Tạo lúc:</strong> {formatDate(link.createdAt)}
                      </p>
                      {link.isUsed && link.usedAt && (
                        <p className="text-sm text-green-600">
                          <strong>Đã dùng lúc:</strong> {formatDate(link.usedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Link vượt:</span>
                      <Button 
                        variant="outlined" 
                        size="sm"
                        onClick={() => copyToClipboard(link.bypassUrl, "link vượt")}
                        data-testid={`button-copy-bypass-${link.id}`}
                      >
                        <CopyRegular className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded break-all">
                      {link.bypassUrl}
                    </p>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      💡 <strong>Hướng dẫn:</strong> Chia sẻ link vượt này với mọi người. 
                      Khi họ vượt link và mở thành công link đích, bạn sẽ nhận được {link.rewardAmount} credit!
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}