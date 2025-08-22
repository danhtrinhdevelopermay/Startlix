import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center relative z-10">
      <Card className="w-full max-w-md mx-4 bg-dark-700/80 border-dark-600 backdrop-blur-md">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <h1 className="text-2xl font-bold text-white">404 - Không tìm thấy trang</h1>
          </div>

          <p className="mt-4 text-sm text-gray-300">
            Trang bạn đang tìm không tồn tại hoặc đã bị di chuyển.
          </p>

          <div className="mt-6">
            <Link to="/">
              <Button className="w-full bg-primary-600 hover:bg-primary-700 text-white">
                <Home className="w-4 h-4 mr-2" />
                Về trang chủ
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
