import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRegister } from "@/hooks/useAuth";
import { Loader2, UserPlus } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const registerMutation = useRegister();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return;
    }
    
    if (username.length < 3) {
      return;
    }
    
    if (password.length < 6) {
      return;
    }

    try {
      await registerMutation.mutateAsync({ username, password });
      setLocation("/");
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Đăng ký</CardTitle>
          <CardDescription className="text-center">
            Tạo tài khoản mới để bắt đầu tạo video AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {registerMutation.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {(registerMutation.error as any)?.message || "Đăng ký thất bại"}
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
                    placeholder="Nhập tên đăng nhập (tối thiểu 3 ký tự)"
                    minLength={3}
                    className="premium-input"
                  />
                  <div className="premium-input-mask"></div>
                  <div className="premium-input-pink-mask"></div>
                </div>
              </div>
              {username.length > 0 && username.length < 3 && (
                <p className="text-sm text-red-500">Tên đăng nhập phải có ít nhất 3 ký tự</p>
              )}
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
                    placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                    minLength={6}
                    className="premium-input"
                  />
                  <div className="premium-input-mask"></div>
                  <div className="premium-input-pink-mask"></div>
                </div>
              </div>
              {password.length > 0 && password.length < 6 && (
                <p className="text-sm text-red-500">Mật khẩu phải có ít nhất 6 ký tự</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="mb-4 block">Xác nhận mật khẩu</Label>
              <div className="premium-input-container">
                <div className="premium-input-wrapper">
                  <div className="premium-input-glow"></div>
                  <div className="premium-input-darkBorderBg"></div>
                  <div className="premium-input-darkBorderBg"></div>
                  <div className="premium-input-darkBorderBg"></div>
                  <div className="premium-input-white"></div>
                  <div className="premium-input-border"></div>
                  <input
                    id="confirmPassword"
                    data-testid="input-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Nhập lại mật khẩu"
                    className="premium-input"
                  />
                  <div className="premium-input-mask"></div>
                  <div className="premium-input-pink-mask"></div>
                </div>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-sm text-red-500">Mật khẩu xác nhận không khớp</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={
                registerMutation.isPending || 
                password !== confirmPassword || 
                username.length < 3 || 
                password.length < 6
              }
              data-testid="button-register"
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang đăng ký...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Đăng ký
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-4 text-center text-sm">
            Đã có tài khoản?{" "}
            <Link to="/login" data-testid="link-login">
              <span className="text-blue-600 hover:underline cursor-pointer">
                Đăng nhập ngay
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}