import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeftRegular } from "@fluentui/react-icons";
import logoUrl from "@/assets/logo.png";

export default function Terms() {
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
              <ArrowLeftRegular className="w-4 h-4 mr-2" />
              Quay lại
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">
            Điều Khoản Sử Dụng
          </h1>
          
          <div className="text-gray-300 space-y-6 leading-relaxed">
            <p className="text-sm text-gray-400">
              Cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}
            </p>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">1. Chấp Nhận Điều Khoản</h2>
              <p>
                Bằng việc truy cập và sử dụng dịch vụ Starlix ("Dịch vụ"), bạn đồng ý tuân thủ và bị ràng buộc bởi 
                các điều khoản và điều kiện được nêu trong tài liệu này. Nếu bạn không đồng ý với bất kỳ phần nào 
                của các điều khoản này, bạn không được phép sử dụng Dịch vụ.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">2. Mô Tả Dịch Vụ</h2>
              <p>
                Starlix là nền tảng tạo video bằng trí tuệ nhân tạo (AI) cho phép người dùng tạo ra video từ văn bản 
                và hình ảnh. Dịch vụ bao gồm nhưng không giới hạn:
              </p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Tạo video từ mô tả văn bản (Text-to-Video)</li>
                <li>Tạo video từ hình ảnh tĩnh (Image-to-Video)</li>
                <li>Xử lý và xuất video với chất lượng cao</li>
                <li>Các tính năng bổ sung khác được cung cấp trong tương lai</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">3. Tài Khoản Người Dùng</h2>
              <p>
                Để sử dụng một số tính năng của Dịch vụ, bạn cần tạo tài khoản. Bạn có trách nhiệm:
              </p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Cung cấp thông tin chính xác và đầy đủ khi đăng ký</li>
                <li>Duy trì tính bảo mật của thông tin đăng nhập</li>
                <li>Thông báo ngay cho chúng tôi về bất kỳ việc sử dụng trái phép nào</li>
                <li>Cập nhật thông tin tài khoản khi cần thiết</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">4. Sử Dụng Có Trách Nhiệm</h2>
              <p>
                Khi sử dụng Dịch vụ, bạn đồng ý KHÔNG:
              </p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Tạo nội dung có tính chất bạo lực, khiêu dâm, hoặc bất hợp pháp</li>
                <li>Vi phạm quyền sở hữu trí tuệ của bên thứ ba</li>
                <li>Sử dụng Dịch vụ để lừa đảo hoặc gây hiểu lầm</li>
                <li>Tải lên virus, malware hoặc mã độc hại</li>
                <li>Can thiệp vào hoạt động bình thường của Dịch vụ</li>
                <li>Sử dụng Dịch vụ cho mục đích thương mại trái phép</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">5. Quyền Sở Hữu Nội Dung</h2>
              <p>
                Bạn giữ quyền sở hữu đối với nội dung đầu vào (văn bản, hình ảnh) mà bạn cung cấp. 
                Đối với video được tạo ra:
              </p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Bạn có quyền sử dụng video cho mục đích cá nhân và thương mại</li>
                <li>Starlix có quyền sử dụng video cho mục đích cải thiện dịch vụ</li>
                <li>Bạn chịu trách nhiệm đảm bảo nội dung không vi phạm quyền của bên thứ ba</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">6. Thanh Toán và Hoàn Tiền</h2>
              <p>
                Các gói dịch vụ trả phí sẽ được tính phí theo chu kỳ đã thỏa thuận. Chính sách hoàn tiền:
              </p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Hoàn tiền trong vòng 7 ngày đối với gói mới đăng ký</li>
                <li>Không hoàn tiền đối với credits đã sử dụng</li>
                <li>Chúng tôi có quyền từ chối hoàn tiền trong trường hợp vi phạm điều khoản</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">7. Giới Hạn Trách Nhiệm</h2>
              <p>
                Starlix cung cấp dịch vụ "nguyên trạng" và không đảm bảo:
              </p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Dịch vụ sẽ hoạt động không bị gián đoạn hoặc không có lỗi</li>
                <li>Chất lượng video luôn đáp ứng mong đợi của bạn</li>
                <li>Dịch vụ sẽ phù hợp với mọi mục đích sử dụng</li>
              </ul>
              <p className="mt-3">
                Chúng tôi không chịu trách nhiệm đối với thiệt hại gián tiếp, ngẫu nhiên, 
                hoặc do hậu quả phát sinh từ việc sử dụng Dịch vụ.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">8. Thay Đổi Điều Khoản</h2>
              <p>
                Chúng tôi có quyền cập nhật các điều khoản này bất cứ lúc nào. Thay đổi sẽ có hiệu lực 
                ngay khi được đăng tải. Việc tiếp tục sử dụng Dịch vụ sau khi thay đổi được coi là 
                bạn chấp nhận các điều khoản mới.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">9. Chấm Dứt Dịch Vụ</h2>
              <p>
                Chúng tôi có quyền tạm ngừng hoặc chấm dứt tài khoản của bạn nếu:
              </p>
              <ul className="list-disc list-inside ml-4 mt-3 space-y-2">
                <li>Bạn vi phạm bất kỳ điều khoản nào trong tài liệu này</li>
                <li>Có hoạt động đáng ngờ hoặc gian lận</li>
                <li>Theo yêu cầu của cơ quan pháp luật</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">10. Liên Hệ</h2>
              <p>
                Nếu bạn có bất kỳ câu hỏi nào về các điều khoản này, vui lòng liên hệ:
              </p>
              <ul className="list-none ml-4 mt-3 space-y-2">
                <li>Email: legal@starlix.ai</li>
                <li>Địa chỉ: Việt Nam</li>
                <li>Điện thoại: +84 xxx xxx xxx</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}