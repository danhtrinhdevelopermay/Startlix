import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlayRegular, SparkleRegular, ArrowRightRegular, CheckmarkRegular, StarRegular } from "@fluentui/react-icons";
import logoUrl from "@/assets/logo.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="relative z-10 border-b border-white/10 backdrop-blur-xl bg-black/20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={logoUrl} alt="Starlix" className="h-10 w-10" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Starlix
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">Tính năng</a>
            <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Giá cả</a>
            <a href="#about" className="text-gray-300 hover:text-white transition-colors">Về chúng tôi</a>
          </nav>
          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost" className="text-white hover:bg-white/10">
                Đăng nhập
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white">
                Bắt đầu ngay
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge className="mb-6 bg-white/10 text-white border-white/20 hover:bg-white/20">
            <SparkleRegular className="w-4 h-4 mr-2" />
            Powered by AI Tiên tiến
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent leading-tight">
            Tạo Video AI
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Chỉ Từ Văn Bản
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
            Biến ý tưởng của bạn thành video chuyên nghiệp với công nghệ AI tiên tiến. 
            Không cần kỹ năng chỉnh sửa video phức tạp.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/register">
              <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-8 py-6 text-lg">
                <PlayRegular className="w-5 h-5 mr-2" />
                Tạo Video Miễn Phí
              </Button>
            </Link>
            <Button size="lg" variant="outlined" className="border-white/20 text-white hover:bg-white/10 px-8 py-6 text-lg">
              Xem Demo
              <ArrowRightRegular className="w-5 h-5 ml-2" />
            </Button>
          </div>
          
          {/* Demo Video Placeholder */}
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-blue-900/50 to-purple-900/50 backdrop-blur-sm border border-white/20">
              <div className="aspect-video flex items-center justify-center">
                <div className="text-center">
                  <PlayRegular className="w-20 h-20 text-blue-400 mx-auto mb-4" />
                  <p className="text-gray-300">Video Demo Starlix AI</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
              Tính Năng Vượt Trội
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Công nghệ AI tiên tiến giúp bạn tạo video chuyên nghiệp chỉ trong vài phút
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <SparkleRegular className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-white">Text-to-Video AI</h3>
                <p className="text-gray-300 leading-relaxed">
                  Chỉ cần mô tả ý tưởng bằng văn bản, AI sẽ tạo ra video hoàn chỉnh với chất lượng cao
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <PlayRegular className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-white">Image-to-Video</h3>
                <p className="text-gray-300 leading-relaxed">
                  Biến ảnh tĩnh thành video động sống động với hiệu ứng chuyển động tự nhiên
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <StarRegular className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-white">Chất Lượng HD/4K</h3>
                <p className="text-gray-300 leading-relaxed">
                  Xuất video với độ phân giải cao, từ HD đến 4K, phù hợp cho mọi nền tảng
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
              Bảng Giá Linh Hoạt
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Chọn gói phù hợp với nhu cầu của bạn
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">Miễn Phí</h3>
                  <div className="text-4xl font-bold text-white mb-2">0đ</div>
                  <p className="text-gray-300">Để thử nghiệm</p>
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    "5 video miễn phí",
                    "Độ phân giải HD",
                    "Thời lượng tối đa 30s",
                    "Watermark có sẵn"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-center text-gray-300">
                      <CheckmarkRegular className="w-5 h-5 text-green-400 mr-3" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button className="w-full bg-white/10 hover:bg-white/20 text-white border-white/20">
                    Bắt Đầu Miễn Phí
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-400/50 backdrop-blur-sm relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0">
                  Phổ Biến
                </Badge>
              </div>
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
                  <div className="text-4xl font-bold text-white mb-2">199,000đ</div>
                  <p className="text-gray-300">/ tháng</p>
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    "Video không giới hạn",
                    "Độ phân giải 4K",
                    "Thời lượng tối đa 5 phút",
                    "Không watermark",
                    "Ưu tiên xử lý",
                    "Hỗ trợ 24/7"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-center text-gray-300">
                      <CheckmarkRegular className="w-5 h-5 text-green-400 mr-3" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white">
                    Nâng Cấp Pro
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
                  <div className="text-4xl font-bold text-white mb-2">Liên hệ</div>
                  <p className="text-gray-300">Cho doanh nghiệp</p>
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    "API tích hợp",
                    "Xử lý hàng loạt",
                    "Tùy chỉnh brand",
                    "SLA đảm bảo",
                    "Đào tạo nhóm",
                    "Quản lý tập trung"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-center text-gray-300">
                      <CheckmarkRegular className="w-5 h-5 text-green-400 mr-3" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button className="w-full bg-white/10 hover:bg-white/20 text-white border-white/20">
                  Liên Hệ Sales
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
            Sẵn Sàng Tạo Video AI?
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Tham gia cùng hàng nghìn người sáng tạo đang sử dụng Starlix để tạo ra những video tuyệt vời
          </p>
          <Link href="/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-12 py-6 text-lg">
              Bắt Đầu Miễn Phí Ngay
              <ArrowRightRegular className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img src={logoUrl} alt="Starlix" className="h-8 w-8" />
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Starlix
                </span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Nền tảng tạo video AI hàng đầu, giúp bạn biến ý tưởng thành hiện thực.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Sản phẩm</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Text-to-Video</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Image-to-Video</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Công ty</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Về chúng tôi</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Liên hệ</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Pháp lý</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/terms" className="hover:text-white transition-colors">Điều khoản sử dụng</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Chính sách bảo mật</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 Starlix. Tất cả quyền được bảo lưu.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                Facebook
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                Twitter
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}