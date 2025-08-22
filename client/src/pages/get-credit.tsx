import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LinkRegular, CopyRegular, CheckmarkRegular } from "@fluentui/react-icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function GetCreditPage() {
  const { toast } = useToast();
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [bypassUrl, setBypassUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const getCreditMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/get-credit");
      return await response.json();
    },
    onSuccess: (data) => {
      setBypassUrl(data.bypassUrl);
      setShowLinkDialog(true);
      toast({
        title: "✅ Link vượt đã được tạo!",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Lỗi tạo link",
        description: error.message || "Không thể tạo link vượt. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(bypassUrl);
      setCopied(true);
      toast({
        title: "✅ Đã sao chép",
        description: "Link đã được sao chép vào clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "❌ Lỗi sao chép",
        description: "Không thể sao chép link. Vui lòng sao chép thủ công.",
        variant: "destructive",
      });
    }
  };

  const handleOpenLink = () => {
    window.open(bypassUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
              <LinkRegular className="w-6 h-6 text-blue-600" />
              Nhận Thêm Credit
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
              Nhấp vào nút dưới đây để nhận link vượt từ LinkBulks. Sau khi hoàn thành link, bạn sẽ được cộng 1 credit vào tài khoản.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="text-center">
              <Button
                onClick={() => getCreditMutation.mutate()}
                disabled={getCreditMutation.isPending}
                size="lg"
                className="px-8 py-3 text-lg font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                data-testid="button-get-credit"
              >
                {getCreditMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Đang tạo link...
                  </>
                ) : (
                  <>
                    <LinkRegular className="w-5 h-5 mr-2" />
                    Nhận Thêm Credit (1 Credit)
                  </>
                )}
              </Button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📝 Cách thức hoạt động:</h3>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                <li>Bấm nút "Nhận Thêm Credit" ở trên</li>
                <li>Hệ thống sẽ tạo link vượt từ LinkBulks</li>
                <li>Hoàn thành link vượt (thường là xem quảng cáo hoặc chờ đợi)</li>
                <li>Sau khi hoàn thành, bạn sẽ được cộng 1 credit tự động</li>
              </ol>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>⚠️ Lưu ý:</strong> Mỗi link chỉ có thể sử dụng 1 lần. Sau khi nhận credit, link sẽ không còn hiệu lực.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog hiển thị link vượt */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkRegular className="w-5 h-5 text-blue-600" />
              Link Vượt Đã Sẵn Sàng
            </DialogTitle>
            <DialogDescription>
              Link vượt đã được tạo thành công! Sao chép link và hoàn thành để nhận credit.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border">
              <p className="text-sm break-all text-gray-700 dark:text-gray-300">
                {bypassUrl}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleCopyLink}
                variant="outlined"
                className="flex-1"
                data-testid="button-copy-link"
              >
                {copied ? (
                  <>
                    <CheckmarkRegular className="w-4 h-4 mr-2" />
                    Đã sao chép
                  </>
                ) : (
                  <>
                    <CopyRegular className="w-4 h-4 mr-2" />
                    Sao chép
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleOpenLink}
                className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                data-testid="button-open-link"
              >
                Mở Link Vượt
              </Button>
            </div>
            
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Sau khi hoàn thành link vượt, credit sẽ được cộng tự động vào tài khoản của bạn.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}