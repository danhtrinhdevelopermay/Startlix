import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLogin } from "@/hooks/useAuth";
import { Loader2, LogIn } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginMutation.mutateAsync({ username, password });
      setLocation("/");
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Đăng nhập</CardTitle>
          <CardDescription className="text-center">
            Nhập thông tin để truy cập tài khoản của bạn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {loginMutation.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {(loginMutation.error as any)?.message || "Đăng nhập thất bại"}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username" className="mb-4 block">Tên đăng nhập</Label>
              <div className="premium-input-container">
                <div className="premium-input-wrapper">
                  <div className="premium-input-glow"></div>
                  <div className="premium-input-darkBorderBg"></div>
                  <div className="premium-input-darkBorderBg"></div>
                  <div className="premium-input-darkBorderBg"></div>
                  <div className="premium-input-white"></div>
                  <div className="premium-input-border"></div>
                  <input
                    id="username"
                    data-testid="input-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Nhập tên đăng nhập"
                    className="premium-input"
                  />
                  <div className="premium-input-mask"></div>
                  <div className="premium-input-pink-mask"></div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="mb-4 block">Mật khẩu</Label>
              <div className="premium-input-container">
                <div className="premium-input-wrapper">
                  <div className="premium-input-glow"></div>
                  <div className="premium-input-darkBorderBg"></div>
                  <div className="premium-input-darkBorderBg"></div>
                  <div className="premium-input-darkBorderBg"></div>
                  <div className="premium-input-white"></div>
                  <div className="premium-input-border"></div>
                  <input
                    id="password"
                    data-testid="input-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Nhập mật khẩu"
                    className="premium-input"
                  />
                  <div className="premium-input-mask"></div>
                  <div className="premium-input-pink-mask"></div>
                </div>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Đăng nhập
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-4 text-center text-sm">
            Chưa có tài khoản?{" "}
            <Link to="/register" data-testid="link-register">
              <span className="text-blue-600 hover:underline cursor-pointer">
                Đăng ký ngay
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}