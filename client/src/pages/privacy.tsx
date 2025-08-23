import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import logoUrl from "@/assets/logo.png";

export default function Privacy() {
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
          <Link href="/">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Quay lại
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">
            Chính Sách Bảo Mật
          </h1>
          
          <div className="text-gray-300 space-y-6 leading-relaxed">
            <p className="text-sm text-gray-400">
              Cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}
            </p>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">1. Giới Thiệu</h2>
              <p>
                Starlix ("chúng tôi", "của chúng tôi") cam kết bảo vệ quyền riêng tư và thông tin cá nhân của bạn. 
                Chính sách bảo mật này giải thích cách chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ thông tin 
                của bạn khi sử dụng dịch vụ Starlix.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">2. Thông Tin Chúng Tôi Thu Thập</h2>
              
              <h3 className="text-lg font-medium text-white mb-3">2.1. Thông tin bạn cung cấp trực tiếp:</h3>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Thông tin tài khoản (email, mật khẩu, tên hiển thị)</li>
                <li>Thông tin thanh toán (qua các nhà cung cấp bên thứ ba)</li>
                <li>Nội dung bạn tạo (văn bản mô tả, hình ảnh tải lên)</li>
                <li>Thông tin liên hệ và hỗ trợ khách hàng</li>
              </ul>

              <h3 className="text-lg font-medium text-white mb-3 mt-4">2.2. Thông tin thu thập tự động:</h3>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Thông tin thiết bị (IP, trình duyệt, hệ điều hành)</li>
                <li>Dữ liệu sử dụng (tính năng được dùng, thời gian truy cập)</li>
                <li>Cookies và công nghệ theo dõi tương tự</li>
                <li>Log hệ thống và dữ liệu hiệu suất</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">3. Cách Chúng Tôi Sử Dụng Thông Tin</h2>
              <p>Chúng tôi sử dụng thông tin của bạn để:</p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Cung cấp và duy trì dịch vụ Starlix</li>
                <li>Xử lý các yêu cầu tạo video của bạn</li>
                <li>Cải thiện và phát triển tính năng mới</li>
                <li>Cung cấp hỗ trợ khách hàng</li>
                <li>Gửi thông báo quan trọng về dịch vụ</li>
                <li>Phát hiện và ngăn chặn gian lận</li>
                <li>Tuân thủ các yêu cầu pháp lý</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">4. Chia Sẻ Thông Tin</h2>
              <p>Chúng tôi KHÔNG bán thông tin cá nhân của bạn. Chúng tôi có thể chia sẻ thông tin trong các trường hợp:</p>
              
              <h3 className="text-lg font-medium text-white mb-3 mt-4">4.1. Với nhà cung cấp dịch vụ:</h3>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Nhà cung cấp dịch vụ AI và xử lý video</li>
                <li>Nhà cung cấp dịch vụ thanh toán</li>
                <li>Nhà cung cấp dịch vụ lưu trữ đám mây</li>
                <li>Nhà cung cấp dịch vụ phân tích và theo dõi</li>
              </ul>

              <h3 className="text-lg font-medium text-white mb-3 mt-4">4.2. Theo yêu cầu pháp lý:</h3>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Khi có lệnh của tòa án hoặc cơ quan pháp luật</li>
                <li>Để tuân thủ các quy định pháp luật hiện hành</li>
                <li>Để bảo vệ quyền và an toàn của chúng tôi và người dùng</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">5. Bảo Mật Thông Tin</h2>
              <p>Chúng tôi áp dụng các biện pháp bảo mật tiêu chuẩn ngành:</p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Mã hóa dữ liệu khi truyền tải (SSL/TLS)</li>
                <li>Mã hóa dữ liệu khi lưu trữ</li>
                <li>Kiểm soát truy cập nghiêm ngặt</li>
                <li>Giám sát hệ thống 24/7</li>
                <li>Đào tạo nhân viên về bảo mật</li>
                <li>Kiểm toán bảo mật định kỳ</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">6. Lưu Trữ Dữ Liệu</h2>
              <p>
                Chúng tôi lưu trữ thông tin của bạn chỉ trong thời gian cần thiết để cung cấp dịch vụ:
              </p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Thông tin tài khoản: Cho đến khi bạn xóa tài khoản</li>
                <li>Nội dung đầu vào: 30 ngày sau khi xử lý (trừ khi bạn yêu cầu xóa sớm hơn)</li>
                <li>Video đã tạo: Theo gói dịch vụ bạn sử dụng</li>
                <li>Dữ liệu log: Tối đa 12 tháng</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">7. Quyền Của Bạn</h2>
              <p>Bạn có các quyền sau đối với thông tin cá nhân:</p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li><strong>Quyền truy cập:</strong> Yêu cầu xem thông tin chúng tôi có về bạn</li>
                <li><strong>Quyền sửa đổi:</strong> Cập nhật thông tin không chính xác</li>
                <li><strong>Quyền xóa:</strong> Yêu cầu xóa thông tin cá nhân</li>
                <li><strong>Quyền hạn chế:</strong> Hạn chế việc xử lý thông tin</li>
                <li><strong>Quyền di chuyển:</strong> Yêu cầu xuất dữ liệu</li>
                <li><strong>Quyền phản đối:</strong> Phản đối việc xử lý thông tin</li>
              </ul>
              <p className="mt-3">
                Để thực hiện các quyền này, vui lòng liên hệ: privacy@starlix.ai
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">8. Cookies và Công Nghệ Theo Dõi</h2>
              <p>Chúng tôi sử dụng cookies và công nghệ tương tự để:</p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Ghi nhớ thông tin đăng nhập</li>
                <li>Cải thiện trải nghiệm người dùng</li>
                <li>Phân tích cách sử dụng dịch vụ</li>
                <li>Cung cấp nội dung phù hợp</li>
              </ul>
              <p className="mt-3">
                Bạn có thể quản lý cookies thông qua cài đặt trình duyệt của mình.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">9. Chuyển Giao Dữ Liệu Quốc Tế</h2>
              <p>
                Dữ liệu của bạn có thể được xử lý tại các quốc gia khác nhau để cung cấp dịch vụ tốt nhất. 
                Chúng tôi đảm bảo mức độ bảo vệ tương đương thông qua:
              </p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Các điều khoản hợp đồng bảo mật</li>
                <li>Chứng nhận bảo mật quốc tế</li>
                <li>Tuân thủ các quy định về bảo vệ dữ liệu</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">10. Thay Đổi Chính Sách</h2>
              <p>
                Chúng tôi có thể cập nhật chính sách bảo mật này theo thời gian. Các thay đổi quan trọng 
                sẽ được thông báo qua email hoặc thông báo trên website. Ngày "Cập nhật lần cuối" ở đầu 
                tài liệu sẽ được cập nhật tương ứng.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">11. Thông Tin Liên Hệ</h2>
              <p>
                Nếu bạn có bất kỳ câu hỏi nào về chính sách bảo mật này, vui lòng liên hệ:
              </p>
              <ul className="list-none ml-4 mt-3 space-y-2">
                <li><strong>Email bảo mật:</strong> privacy@starlix.ai</li>
                <li><strong>Email hỗ trợ:</strong> support@starlix.ai</li>
                <li><strong>Địa chỉ:</strong> Việt Nam</li>
                <li><strong>Điện thoại:</strong> +84 xxx xxx xxx</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">12. Người Dùng Dưới 18 Tuổi</h2>
              <p>
                Dịch vụ Starlix không dành cho người dưới 18 tuổi. Chúng tôi không cố ý thu thập 
                thông tin cá nhân từ trẻ em dưới 18 tuổi. Nếu chúng tôi phát hiện việc thu thập 
                như vậy, chúng tôi sẽ xóa thông tin ngay lập tức.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}