-- Knowledge Base: Vietnamese translations of all 27 articles
-- Slugs use -vi suffix to avoid conflict with English versions

INSERT INTO knowledge_base (title, slug, content_markdown, category, is_active) VALUES

-- ── GENERAL ───────────────────────────────────────────────────────────────────

(
  'BizFlow là gì?',
  'what-is-bizflow-vi',
  E'# BizFlow là gì?\n\nBizFlow là nền tảng tự động hóa quy trình làm việc, giúp các tổ chức số hóa và tự động hóa các quy trình kinh doanh — mà không cần viết code.\n\n## Bạn có thể làm gì\n\n- **Xây dựng quy trình trực quan** — kéo và thả các bước lên canvas để thiết kế luồng phê duyệt, biểu mẫu yêu cầu và quy trình nhiều bước\n- **Phân công công việc cho cá nhân hoặc nhóm** — tự động chuyển nhiệm vụ đến đúng người, phòng ban, quản lý hoặc người phê duyệt cấp cao\n- **Đặt thời hạn (SLA)** — giới hạn thời gian cho mỗi bước để không có việc nào bị bỏ quên\n- **Sử dụng trợ lý AI** — để AI giúp bạn xây dựng quy trình từ mô tả bằng ngôn ngữ tự nhiên, gợi ý trường biểu mẫu hoặc tìm đúng quy trình cần khởi động\n- **Theo dõi mọi thứ** — thông báo thời gian thực, bảng điều khiển phân tích điểm nghẽn và báo cáo chi tiết\n\n## Ai sử dụng BizFlow\n\n| Vai trò | Công việc |\n|---------|----------|\n| **Quản trị viên** | Tạo và công bố quy trình, quản lý thành viên và phòng ban, xem báo cáo |\n| **Thành viên** | Hoàn thành nhiệm vụ được giao, khởi động các quy trình cần thiết |\n\n## Bắt đầu\n\n1. Đăng ký tại bizflow.id.vn và tạo tổ chức của bạn\n2. Mời các thành viên trong nhóm\n3. Xây dựng quy trình đầu tiên — hoặc bắt đầu từ một mẫu có sẵn\n4. Công bố quy trình để nhóm có thể sử dụng',
  'general',
  true
),

(
  'Các vai trò người dùng trong BizFlow',
  'user-roles-in-bizflow-vi',
  E'# Các vai trò người dùng trong BizFlow\n\nBizFlow có hai vai trò người dùng: **Quản trị viên** và **Thành viên**.\n\n## Quản trị viên (Admin)\n\nQuản trị viên có toàn quyền kiểm soát không gian làm việc:\n\n- Tạo, chỉnh sửa, công bố và xóa quy trình\n- Mời, vô hiệu hóa và quản lý thành viên\n- Tạo và quản lý phòng ban\n- Xem tất cả phiên chạy quy trình và xuất dữ liệu\n- Truy cập báo cáo và phân tích quản trị\n- Cấu hình AI và thanh toán\n\n## Thành viên (Member)\n\nThành viên tương tác với các quy trình đã được công bố:\n\n- Xem danh sách quy trình khả dụng cho phòng ban của mình\n- Khởi động (trigger) các quy trình\n- Hoàn thành các nhiệm vụ được giao\n- Xem lịch sử nhiệm vụ và quy trình đã khởi động\n- Nhận thông báo cho nhiệm vụ được giao và quy trình hoàn thành\n\n## Thay đổi vai trò người dùng\n\nQuản trị viên có thể nâng cấp thành viên thành quản trị viên (hoặc hạ cấp) từ danh sách Người dùng:\n\n1. Vào **Người dùng**\n2. Tìm người dùng và mở hồ sơ của họ\n3. Thay đổi vai trò và lưu\n\nThay đổi vai trò có hiệu lực vào lần đăng nhập tiếp theo của người dùng.',
  'general',
  true
),

(
  'Cách đổi tên tổ chức',
  'how-to-rename-organisation-vi',
  E'# Cách đổi tên tổ chức\n\nQuản trị viên có thể cập nhật tên không gian làm việc hiển thị trên BizFlow.\n\n## Các bước\n\n1. Vào **Cài đặt** trong thanh điều hướng bên trái (chỉ dành cho quản trị viên)\n2. Tab **Chung** là tab mặc định\n3. Tìm trường **Tên tổ chức**\n4. Chỉnh sửa tên và nhấn **Lưu**\n\nTên mới sẽ được phản ánh ngay lập tức trên toàn bộ không gian làm việc của bạn.',
  'general',
  true
),

-- ── BILLING ───────────────────────────────────────────────────────────────────

(
  'Bảng giá và các gói dịch vụ',
  'pricing-and-plans-vi',
  E'# Bảng giá và các gói dịch vụ\n\nBizFlow cung cấp ba gói dịch vụ phù hợp với mọi quy mô tổ chức.\n\n## Miễn phí — $0 / tháng\n\nPhù hợp với các nhóm nhỏ mới bắt đầu.\n\n- Tối đa **10 người dùng** (bao gồm quản trị viên)\n- Tối đa **2 quy trình** đang hoạt động\n- Tối đa **5 phòng ban**\n- Báo cáo: chỉ xem **7 ngày** gần nhất\n- Tính năng AI: không khả dụng\n\n## Pro — $5 / người dùng / tháng\n\nDành cho các nhóm đang phát triển cần quy trình không giới hạn và công cụ AI.\n\n- Tối đa **100 người dùng**\n- Quy trình và phòng ban **không giới hạn**\n- Lịch sử báo cáo đầy đủ (7 ngày / 30 ngày / 90 ngày / toàn bộ)\n- **AI xây dựng quy trình**, gợi ý trường biểu mẫu, điều kiện rẽ nhánh tự nhiên và trợ lý viết văn bản\n\n## Enterprise — Liên hệ\n\nDành cho các tổ chức lớn với yêu cầu tùy chỉnh.\n\n- Người dùng, quy trình và phòng ban **không giới hạn**\n- Phân tích và báo cáo đầy đủ\n- Tính năng AI với hạn mức tín dụng tùy chỉnh theo tổ chức\n- Hỗ trợ chuyên dụng và SLA tùy chỉnh\n- Liên hệ contact@bizflow.id.vn để biết giá\n\n## Câu hỏi thường gặp về thanh toán\n\n**Gói Pro được tính phí như thế nào?** Theo số người dùng hoạt động, mỗi tháng.\n\n**Tôi có thể đổi gói không?** Có. Quản trị viên có thể nâng cấp hoặc xem lại gói tại **Cài đặt → Thanh toán**.\n\n**Điều gì xảy ra nếu tôi vượt quá giới hạn?** Bạn sẽ thấy thông báo nội tuyến khi đạt giới hạn gói. Hành động bị chặn cho đến khi bạn nâng cấp.\n\n**Có dùng thử miễn phí không?** Gói Miễn phí là miễn phí vô thời hạn. Nâng cấp lên Pro khi cần thêm người dùng hoặc tính năng AI.',
  'billing',
  true
),

(
  'Cách kiểm tra gói dịch vụ và mức sử dụng',
  'how-to-check-plan-usage-vi',
  E'# Cách kiểm tra gói dịch vụ và mức sử dụng\n\nQuản trị viên có thể xem gói hiện tại, mức sử dụng và thông tin thanh toán trong Cài đặt.\n\n## Các bước\n\n1. Vào **Cài đặt** trong thanh điều hướng bên trái (chỉ dành cho quản trị viên)\n2. Nhấn tab **Thanh toán**\n\n## Bạn sẽ thấy\n\n- Huy hiệu **gói hiện tại** (Miễn phí, Pro hoặc Enterprise)\n- **Thanh đo mức sử dụng** cho người dùng, quy trình và phòng ban (ví dụ: 7 / 10 với gói Miễn phí)\n- Khả dụng lịch sử **báo cáo**\n- Nút **Nâng cấp** dành cho người dùng gói Miễn phí\n\n## Khi gần đạt giới hạn\n\nKhi bạn cố thêm nhiều người dùng, quy trình hoặc phòng ban hơn mức gói cho phép, bạn sẽ thấy thông báo lỗi nội tuyến và gợi ý nâng cấp.',
  'billing',
  true
),

(
  'Tính năng AI và hạn mức sử dụng',
  'ai-features-and-credit-usage-vi',
  E'# Tính năng AI và hạn mức sử dụng\n\nCác tính năng AI của BizFlow khả dụng trên gói **Pro** và **Enterprise**.\n\n## Các tính năng AI\n\n| Tính năng | Ai sử dụng | Chức năng |\n|-----------|-----------|----------|\n| AI xây dựng quy trình | Quản trị viên | Tạo hoặc chỉnh sửa quy trình từ mô tả bằng ngôn ngữ tự nhiên |\n| Gợi ý trường biểu mẫu | Quản trị viên | Đề xuất các trường phù hợp cho một bước dựa trên tên bước |\n| Điều kiện rẽ nhánh tự nhiên | Quản trị viên | Chuyển quy tắc ngôn ngữ tự nhiên thành điều kiện rẽ nhánh |\n| Trợ lý khởi động quy trình | Thành viên | Khớp yêu cầu ngôn ngữ tự nhiên với quy trình phù hợp nhất |\n| Trợ lý viết văn bản AI | Thành viên | Soạn thảo hoặc viết lại nội dung trường văn bản dài |\n\n## Bật AI\n\n1. Vào **Cài đặt → AI** (chỉ quản trị viên)\n2. Bật **Bật tính năng AI**\n3. Chọn nhà cung cấp (Anthropic/Claude hoặc OpenAI/GPT) và mô hình\n4. Chọn **Khóa nền tảng** (tính vào hạn mức tín dụng của bạn) hoặc **Khóa riêng** (thanh toán trực tiếp với nhà cung cấp)\n\n## Mức sử dụng tín dụng\n\nKhi dùng khóa nền tảng, mức sử dụng và tín dụng còn lại được hiển thị tại Cài đặt → AI dưới dạng thanh tiến trình.',
  'billing',
  true
),

-- ── ACCOUNT ───────────────────────────────────────────────────────────────────

(
  'Cách đăng ký tài khoản',
  'how-to-sign-up-vi',
  E'# Cách đăng ký tài khoản\n\nTạo tài khoản BizFlow chỉ mất chưa đến một phút.\n\n## Các bước\n\n1. Truy cập **bizflow.id.vn** và nhấn **Bắt đầu miễn phí** (hoặc **Đăng ký**)\n2. Nhập **địa chỉ email** và **mật khẩu** (tối thiểu 8 ký tự)\n3. Nhấn **Tạo tài khoản**\n4. Bạn sẽ được đăng nhập và chuyển đến không gian làm việc — tổ chức của bạn được tạo tự động với tên "My Organisation"\n\n## Sau khi đăng ký\n\n- Bạn là **Quản trị viên** của không gian làm việc mới\n- Đổi tên tổ chức tại **Cài đặt → Chung**\n- Mời thành viên nhóm từ **Người dùng → Mời người dùng**\n- Xây dựng quy trình đầu tiên từ **Quy trình → Quy trình mới**\n\n## Đã có tài khoản?\n\nNếu bạn được mời bởi đồng nghiệp, đừng đăng ký mới — hãy dùng link **Chấp nhận lời mời** trong email mời. Tạo tài khoản mới sẽ tạo một không gian làm việc riêng biệt, không phải tham gia không gian của đồng nghiệp.',
  'account',
  true
),

(
  'Cách chấp nhận lời mời',
  'how-to-accept-invitation-vi',
  E'# Cách chấp nhận lời mời\n\nKhi quản trị viên mời bạn vào không gian làm việc BizFlow, bạn sẽ nhận được email mời.\n\n## Các bước\n\n1. Mở email mời từ BizFlow\n2. Nhấn **Chấp nhận lời mời** (hoặc "Thiết lập tài khoản của bạn")\n3. Bạn sẽ được chuyển đến trang thiết lập tài khoản — nhập **họ tên đầy đủ** và đặt **mật khẩu**\n4. Nhấn **Lưu** — bạn sẽ được đăng nhập và chuyển đến trang nhiệm vụ\n\n## Link hết hạn?\n\nLink mời có hiệu lực trong **24 giờ**. Nếu link đã hết hạn:\n\n1. Liên hệ quản trị viên và yêu cầu **gửi lại lời mời**\n2. Họ có thể làm điều này từ **Người dùng → Lời mời đang chờ → Gửi lại**\n3. Bạn sẽ nhận được email mời mới\n\n## Lưu ý\n\n- Không tạo tài khoản mới tại trang đăng ký — điều đó sẽ tạo ra một không gian làm việc riêng biệt, trống\n- Vai trò của bạn (Quản trị viên hoặc Thành viên) được thiết lập bởi người đã mời bạn',
  'account',
  true
),

(
  'Cách cập nhật hồ sơ cá nhân',
  'how-to-update-profile-vi',
  E'# Cách cập nhật hồ sơ cá nhân\n\nBạn có thể cập nhật tên, chức danh, số điện thoại và ảnh đại diện bất cứ lúc nào.\n\n## Các bước\n\n1. Nhấn vào **ảnh đại diện** ở góc trên bên phải của bất kỳ trang nào\n2. Chọn **Hồ sơ** từ menu thả xuống\n3. Trên trang Hồ sơ:\n   - Chỉnh sửa **Họ tên**, **Chức danh** hoặc **Số điện thoại**\n   - Nhấn **Lưu thay đổi** khi xong\n4. Để thay đổi **ảnh đại diện**:\n   - Nhấn vào ảnh hoặc nút tải lên bên dưới\n   - Chọn file ảnh từ máy tính\n   - Ảnh được lưu tự động\n\n## Lưu ý về email\n\nĐịa chỉ email của bạn là chỉ đọc trong biểu mẫu hồ sơ. Để thay đổi email đăng nhập, hãy liên hệ quản trị viên tổ chức hoặc BizFlow support tại contact@bizflow.id.vn.',
  'account',
  true
),

(
  'Cách bật xác thực hai yếu tố (MFA)',
  'how-to-enable-mfa-vi',
  E'# Cách bật xác thực hai yếu tố (MFA)\n\nXác thực hai yếu tố tăng thêm một lớp bảo mật cho tài khoản của bạn. Sau khi nhập mật khẩu, bạn cũng cần nhập mã một lần từ ứng dụng xác thực.\n\n## Bạn cần gì\n\nMột ứng dụng xác thực trên điện thoại, chẳng hạn:\n- Google Authenticator\n- Authy\n- Microsoft Authenticator\n- 1Password\n\n## Bật MFA\n\n1. Nhấn vào **ảnh đại diện** góc trên phải và chọn **Hồ sơ**\n2. Cuộn xuống phần **Bảo mật**\n3. Nhấn **Thiết lập xác thực hai yếu tố**\n4. Mở ứng dụng xác thực và quét mã QR hiển thị, hoặc nhập khóa bí mật thủ công\n5. Nhập mã 6 chữ số từ ứng dụng xác thực để xác minh\n6. Nhấn **Xác minh** — MFA hiện đã hoạt động\n\n## Đăng nhập với MFA\n\nSau khi nhập mật khẩu, bạn sẽ được chuyển đến trang xác minh. Mở ứng dụng xác thực, nhập mã 6 chữ số hiện tại và nhấn **Xác minh**.\n\n## Tắt MFA\n\n1. Vào **Hồ sơ → Bảo mật**\n2. Nhấn **Tắt xác thực hai yếu tố**\n3. Xác nhận khi được hỏi\n\n## Mất quyền truy cập vào ứng dụng xác thực?\n\nLiên hệ quản trị viên tổ chức hoặc BizFlow support tại contact@bizflow.id.vn.',
  'account',
  true
),

(
  'Đặt lại mật khẩu',
  'reset-password-vi',
  E'# Đặt lại mật khẩu\n\nNếu bạn quên mật khẩu hoặc muốn thay đổi, hãy làm theo các bước sau.\n\n## Nếu bạn đã đăng xuất\n\n1. Truy cập trang đăng nhập BizFlow\n2. Nhấn **Quên mật khẩu?** bên dưới biểu mẫu đăng nhập\n3. Nhập địa chỉ email và nhấn **Gửi link đặt lại**\n4. Kiểm tra hộp thư đến để nhận email từ BizFlow\n5. Nhấn vào link trong email — bạn sẽ được chuyển đến trang đặt mật khẩu mới\n6. Nhập và xác nhận mật khẩu mới, sau đó nhấn **Lưu**\n\nLink đặt lại hết hạn sau **1 giờ**. Nếu đã hết hạn, hãy lặp lại các bước trên để nhận link mới.\n\n## Nếu bạn đã đăng nhập\n\nBạn có thể thay đổi mật khẩu từ trang hồ sơ:\n\n1. Nhấn vào **ảnh đại diện** góc trên phải\n2. Chọn **Hồ sơ**\n3. Dùng phần mật khẩu để đặt mật khẩu mới\n\n## Không nhận được email?\n\n- Kiểm tra thư mục spam / thư rác\n- Đảm bảo bạn đang kiểm tra hộp thư của địa chỉ email đã đăng ký với BizFlow\n- Chờ 2–3 phút — đôi khi gửi email có thể bị chậm\n- Nếu vẫn không nhận được, liên hệ support tại contact@bizflow.id.vn',
  'account',
  true
),

-- ── HOW-TO ────────────────────────────────────────────────────────────────────

(
  'Cách mời người dùng',
  'how-to-invite-users-vi',
  E'# Cách mời người dùng\n\nQuản trị viên có thể mời thành viên mới vào không gian làm việc BizFlow bằng cách gửi email magic link.\n\n## Các bước\n\n1. Vào **Người dùng** trong thanh điều hướng bên trái\n2. Nhấn **Mời người dùng** ở góc trên bên phải\n3. Nhập **địa chỉ email** của người đó và chọn **vai trò** (Quản trị viên hoặc Thành viên)\n4. Nhấn **Gửi lời mời**\n\nNgười được mời sẽ nhận email với **link một cú nhấp** để thiết lập tài khoản. Link có hiệu lực trong **24 giờ**.\n\n## Kiểm tra lời mời đang chờ\n\n1. Vào **Người dùng → Lời mời đang chờ**\n2. Danh sách hiển thị trạng thái từng lời mời (Đang chờ / Đã chấp nhận), người gửi và thời gian gửi gần nhất\n3. Nhấn **Gửi lại** để gửi link mới nếu link cũ đã hết hạn\n4. Nhấn **Thu hồi** để hủy lời mời và xóa tài khoản\n\n## Mời hàng loạt qua CSV\n\n1. Vào **Người dùng → Nhập hàng loạt**\n2. Tải xuống mẫu CSV\n3. Điền email, họ tên, vai trò và có gửi email mời hay không\n4. Tải lên file và xem trước\n5. Nhấn **Nhập** — kết quả hiển thị thành công hoặc lỗi từng dòng\n\n## Giới hạn gói\n\nSố người dùng được phép tùy thuộc vào gói (10 với gói Miễn phí, 100 với Pro). Bạn sẽ thấy lỗi nếu cố mời quá giới hạn.',
  'how-to',
  true
),

(
  'Cách tạo quy trình làm việc',
  'how-to-create-workflow-vi',
  E'# Cách tạo quy trình làm việc\n\n## Quy trình làm việc là gì?\n\nQuy trình làm việc là chuỗi các bước chuyển một công việc từ đầu đến cuối — ví dụ: đơn xin nghỉ phép được chuyển đến quản lý phê duyệt, sau đó đến HR để ghi nhận.\n\n## Tạo quy trình (chỉ Quản trị viên)\n\n1. Vào **Quy trình** trong thanh điều hướng bên trái\n2. Nhấn **Quy trình mới** (hoặc mở Mẫu từ nút **Mẫu**)\n3. Đặt tên và danh mục tùy chọn cho quy trình\n\n## Xây dựng canvas\n\nBạn sẽ thấy canvas với nút **Trigger** (Khởi động) và **Complete** (Hoàn thành) đã được đặt sẵn.\n\n- **Thêm bước**: nhấn nút + trên bất kỳ nút nào, hoặc kéo từ thanh công cụ nút\n- **Nút Hành động**: bước mà ai đó điền vào biểu mẫu\n- **Nút Rẽ nhánh**: quyết định có/không định tuyến quy trình dựa trên giá trị trường\n\n## Cấu hình một bước\n\n1. Nhấn vào nút bước để mở bảng cấu hình bên phải\n2. Đặt **tên bước** (ví dụ: "Quản lý phê duyệt")\n3. Thêm **trường biểu mẫu** — văn bản ngắn, văn bản dài, danh sách thả xuống, hộp kiểm, tải file và nhiều hơn nữa\n4. Đặt **quy tắc phân công** — ai nhận bước này:\n   - Người yêu cầu (người đã khởi động quy trình)\n   - Quản lý của người yêu cầu\n   - Một địa chỉ email cụ thể\n   - Trưởng phòng ban\n   - Quản lý cấp trên\n5. Tùy chọn đặt **thời hạn** (ví dụ: "Hết hạn trong 2 ngày")\n\n## Sử dụng AI để xây dựng quy trình\n\nNhấn nút **AI (Sparkles)** trong thanh công cụ và mô tả những gì bạn cần bằng ngôn ngữ tự nhiên. BizFlow sẽ tạo ra quy trình hoàn chỉnh để bạn xem xét và điều chỉnh.\n\n## Công bố quy trình\n\n1. Mở bảng **Công bố** (thanh bên phải)\n2. Nhấn **Công bố** — quy trình sẽ khả dụng để nhóm khởi động\n\nCác quy trình đã công bố được phiên bản hóa. Bạn có thể tiếp tục chỉnh sửa bản nháp mà không ảnh hưởng đến các phiên đang chạy.',
  'how-to',
  true
),

(
  'Cách khởi động quy trình',
  'how-to-start-workflow-vi',
  E'# Cách khởi động quy trình\n\nBất kỳ thành viên nào cũng có thể khởi động quy trình đã công bố mà quản trị viên đã cấp quyền cho họ.\n\n## Các bước\n\n1. Vào **Quy trình** trong thanh điều hướng bên trái\n2. Bạn sẽ thấy danh sách các quy trình khả dụng cho bạn\n3. Nhấn **Khởi động** (hoặc nút play) bên cạnh quy trình bạn muốn bắt đầu\n4. Quy trình sẽ bắt đầu ngay lập tức và bước đầu tiên sẽ được phân công\n\n## Dùng AI để tìm đúng quy trình\n\nNếu bạn không chắc nên dùng quy trình nào:\n\n1. Trên trang Quy trình, tìm bảng **"Khởi động quy trình với AI"** ở đầu trang\n2. Mô tả những gì bạn cần bằng ngôn ngữ tự nhiên — ví dụ: "Tôi cần gửi đơn xin nghỉ phép cho tuần tới"\n3. BizFlow AI sẽ khớp yêu cầu của bạn với quy trình phù hợp nhất và giải thích lý do\n4. Nhấn **Bắt đầu quy trình này** nếu kết quả đúng\n\n## Lưu ý\n\n- Bạn chỉ thấy các quy trình đã công bố và khả dụng cho phòng ban của bạn\n- Sau khi khởi động, tìm nhiệm vụ đang chờ tại **Nhiệm vụ → Đang chờ**',
  'how-to',
  true
),

(
  'Cách hoàn thành nhiệm vụ',
  'how-to-complete-task-vi',
  E'# Cách hoàn thành nhiệm vụ\n\nKhi một bước trong quy trình được phân công cho bạn, bạn sẽ nhận được thông báo qua email và trong ứng dụng.\n\n## Tìm nhiệm vụ của bạn\n\n1. Vào **Nhiệm vụ** trong thanh điều hướng bên trái (đây là trang chủ sau khi đăng nhập)\n2. Tab **Đang chờ** hiển thị tất cả các bước đang chờ hành động của bạn\n3. Mỗi thẻ nhiệm vụ hiển thị tên quy trình, tên bước, người đã khởi động và thời hạn\n\n## Hoàn thành nhiệm vụ\n\n1. Nhấn vào thẻ nhiệm vụ để mở\n2. Điền vào các trường biểu mẫu (câu trả lời văn bản, danh sách thả xuống, tải file, v.v.)\n3. Bạn có thể **Lưu nháp** để quay lại sau mà không cần gửi\n4. Khi sẵn sàng, nhấn **Gửi** — quy trình chuyển sang bước tiếp theo\n\n## Xem bối cảnh từ các bước trước\n\nTrong chế độ xem chi tiết nhiệm vụ, bạn có thể xem câu trả lời từ các bước trước trong cùng quy trình — hữu ích để có bối cảnh trước khi điền.\n\n## Thời hạn\n\nNếu bước có thời hạn, bạn sẽ thấy ngày hết hạn trên thẻ nhiệm vụ:\n- **Màu hổ phách** — còn dưới 24 giờ\n- **Màu đỏ** — đã quá hạn\n\nNếu bạn bỏ lỡ thời hạn, quản lý của bạn có thể nhận được thông báo leo thang.',
  'how-to',
  true
),

(
  'Cách xem lịch sử quy trình',
  'how-to-view-flow-history-vi',
  E'# Cách xem lịch sử quy trình\n\n## Quy trình bạn đã khởi động\n\n1. Vào **Nhiệm vụ** trong thanh điều hướng bên trái\n2. Nhấn tab **Quy trình của tôi**\n3. Bạn sẽ thấy tất cả quy trình bạn đã khởi động, với trạng thái hiện tại\n4. Nhấn vào bất kỳ dòng nào để mở toàn bộ chuỗi — xem từng bước, ai đã hoàn thành và họ đã gửi gì\n\n## Nhiệm vụ đã hoàn thành\n\n1. Vào **Nhiệm vụ → Lịch sử**\n2. Hiển thị mọi bước bạn đã hoàn thành, nhóm theo phiên quy trình\n\n## Dành cho quản trị viên: tất cả phiên trên toàn nhóm\n\n1. Vào **Quản trị → Phiên** trong thanh bên\n2. Dùng các bộ lọc (quy trình, trạng thái, người khởi động, phạm vi ngày, tìm kiếm) để thu hẹp kết quả\n3. Nhấn bất kỳ dòng nào để mở bảng chi tiết\n4. Dùng **Xuất** để tải xuống CSV của kết quả đã lọc',
  'how-to',
  true
),

(
  'Cách sử dụng AI để xây dựng quy trình',
  'how-to-use-ai-flow-builder-vi',
  E'# Cách sử dụng AI để xây dựng quy trình\n\nTính năng AI cho phép bạn mô tả quy trình bằng tiếng Việt và BizFlow sẽ tạo canvas cho bạn. Khả dụng trên gói Pro.\n\n## Tạo quy trình mới\n\n1. Vào **Quy trình → Quy trình mới**\n2. Trên canvas, nhấn nút **AI (Sparkles)** trong thanh công cụ\n3. Chọn **Tạo quy trình mới**\n4. Nhập mô tả — ví dụ: "Quy trình xin nghỉ phép: nhân viên gửi ngày và lý do, quản lý phê duyệt, HR ghi nhận"\n5. Nhấn **Tạo** — BizFlow tạo canvas đầy đủ với các bước, trường và quy tắc phân công\n6. Xem xét và điều chỉnh, sau đó công bố khi sẵn sàng\n\n## Chỉnh sửa quy trình hiện có\n\n1. Trên canvas đã có nút, nhấn nút **AI**\n2. Chọn **Chỉnh sửa hiện có**\n3. Mô tả thay đổi — "Thêm bước phê duyệt Tài chính sau bước của quản lý"\n4. Nhấn **Tạo** — canvas của bạn được cập nhật\n\n## Mẹo để có kết quả tốt hơn\n\n- Đề cập vai trò rõ ràng: "được phân công cho quản lý của người yêu cầu"\n- Mô tả các trường biểu mẫu cần thiết: "trường cho ngày bắt đầu, ngày kết thúc và lý do"\n- Giữ mô tả trong 1–3 câu\n\n## Bật AI\n\nAI phải được quản trị viên bật trong **Cài đặt → AI**.',
  'how-to',
  true
),

(
  'Cách quản lý phòng ban',
  'how-to-manage-departments-vi',
  E'# Cách quản lý phòng ban\n\nPhòng ban tổ chức nhóm của bạn cho việc phân công bước, báo cáo và kiểm soát truy cập. Dành cho quản trị viên.\n\n## Tạo phòng ban\n\n1. Vào **Phòng ban → Quản lý** trong thanh bên\n2. Nhấn **Phòng ban mới**\n3. Nhập tên và tùy chọn chọn phòng ban cha (tối đa 3 cấp) và trưởng phòng\n\n## Quản lý thành viên\n\n1. Mở phòng ban → Hành động → **Thành viên**\n2. Thêm người dùng bằng cách chọn từ danh sách thả xuống (họ sẽ được chuyển từ phòng ban hiện tại)\n3. Xóa thành viên bằng cách nhấn ✕ bên cạnh tên\n\n## Đặt trưởng phòng\n\nTrưởng phòng được dùng làm tùy chọn phân công trong quy trình ("Chuyển đến trưởng phòng"). Chỉnh sửa phòng ban và chọn người dùng trong trường Trưởng phòng.\n\n## Khối lượng công việc phòng ban\n\nVào **Phòng ban → Khối lượng công việc** để xem nhiệm vụ đang chờ, bước quá hạn và thời hạn sắp tới theo từng phòng ban.\n\n## Hợp nhất phòng ban\n\nMở phòng ban nguồn → Hành động → **Hợp nhất vào…** → chọn phòng ban đích → tùy chọn xóa phòng ban nguồn. Tất cả người dùng sẽ được chuyển sang phòng ban đích.',
  'how-to',
  true
),

(
  'Cách đặt thời hạn SLA cho các bước quy trình',
  'how-to-set-sla-deadlines-vi',
  E'# Cách đặt thời hạn SLA cho các bước quy trình\n\nBạn có thể đặt giới hạn thời gian cho bất kỳ bước nào để đảm bảo nhiệm vụ không bị trì hoãn.\n\n## Đặt thời hạn\n\n1. Mở quy trình ở chế độ chỉnh sửa\n2. Nhấn vào nút **Hành động** hoặc **Rẽ nhánh**\n3. Trong bảng cấu hình, tìm mục **"Hết hạn trong"**\n4. Nhập số và chọn giờ hoặc ngày (ví dụ: "2 ngày")\n5. Tùy chọn đặt **"Leo thang sau N giờ quá hạn"** để thông báo cho quản lý của người được phân công\n\n## Cách hiển thị thời hạn\n\nNgày hết hạn xuất hiện trên thẻ nhiệm vụ:\n- **Màu xám** — còn nhiều thời gian\n- **Màu hổ phách** — còn dưới 24 giờ\n- **Màu đỏ** — đã quá hạn\n\nThời hạn cũng xuất hiện trong bảng điều khiển quản trị và chế độ xem khối lượng công việc phòng ban.\n\n## Lưu ý\n\n- Thời hạn tính theo **giờ dương lịch**, không phải giờ làm việc\n- Nếu không đặt thời hạn, không có huy hiệu thời hạn nào xuất hiện\n- Thời hạn được tính từ thời điểm bước được phân công',
  'how-to',
  true
),

(
  'Cách xem báo cáo và phân tích',
  'how-to-view-reports-vi',
  E'# Cách xem báo cáo và phân tích\n\n## Bảng điều khiển\n\nVào **Bảng điều khiển** để xem tổng quan thời gian thực:\n- Thẻ thống kê: tổng quy trình, phiên đang hoạt động, hoàn thành, đã hủy, vi phạm SLA, sắp đến hạn\n- Bảng phân tích theo quy trình: lượt chạy, đang chờ, hoàn thành, đã hủy, số lỗi\n- Bảng điểm nghẽn: ai có nhiều nhiệm vụ đang chờ nhất và nhiệm vụ cũ nhất đã chờ bao lâu\n\n## Báo cáo hiệu suất quy trình\n\nVào **Quản trị → Báo cáo → Quy trình**:\n- Thời gian chu kỳ trung bình mỗi quy trình\n- Tỷ lệ hoàn thành, hủy và lỗi\n- Phân tích theo cấp bước sắp xếp theo thời gian chờ trung vị\n- Bộ chọn thời gian: 7 / 30 / 90 ngày hoặc toàn bộ\n\n## Báo cáo tuân thủ SLA\n\nVào **Quản trị → Báo cáo → SLA**:\n- Số lượng đúng hạn vs vi phạm theo quy trình\n- Tỷ lệ vi phạm với màu sắc (đỏ trên 20%, hổ phách trên 10%)\n- Phân tích theo cấp bước và phân tích hiệu quả leo thang\n- Xuất CSV\n\n## Giới hạn gói\n\nCác khoảng thời gian báo cáo quá 7 ngày yêu cầu gói **Pro**.',
  'how-to',
  true
),

(
  'Cách sử dụng sơ đồ tổ chức',
  'how-to-use-org-chart-vi',
  E'# Cách sử dụng sơ đồ tổ chức\n\nSơ đồ tổ chức cho bạn thấy tổng quan trực quan về cấu trúc báo cáo của nhóm.\n\n## Xem sơ đồ tổ chức\n\n1. Vào **Sơ đồ tổ chức** trong thanh bên\n2. Tất cả thành viên đang hoạt động được sắp xếp theo quan hệ quản lý và trưởng phòng ban\n3. Huy hiệu hiển thị: tên phòng ban, Trưởng (hổ phách) và vai trò\n\n## Cập nhật cấu trúc báo cáo (chỉ Quản trị viên)\n\n1. Kéo tay cầm kết nối từ nút của một người đến nút của người khác để cập nhật người họ báo cáo\n2. Kiểm tra vòng lặp ngăn chuỗi báo cáo vòng tròn\n\n## Thư mục người dùng\n\nĐể xem lưới thẻ có thể tìm kiếm của tất cả thành viên, vào **Thư mục** trong thanh bên. Lọc theo tên, email hoặc phòng ban (bao gồm các phòng ban con).',
  'how-to',
  true
),

(
  'Cách vô hiệu hóa và kích hoạt lại người dùng',
  'how-to-deactivate-user-vi',
  E'# Cách vô hiệu hóa và kích hoạt lại người dùng\n\nKhi thành viên rời đi, hãy vô hiệu hóa tài khoản của họ thay vì xóa. Người dùng bị vô hiệu hóa không thể đăng nhập và bị loại khỏi phân công nhiệm vụ, nhưng lịch sử công việc của họ được giữ lại.\n\n## Vô hiệu hóa người dùng\n\n1. Vào **Người dùng** trong thanh bên\n2. Nhấn **Hành động → Vô hiệu hóa người dùng** trên dòng của họ và xác nhận\n\n## Điều gì xảy ra\n\n- Người dùng bị đăng xuất ngay lập tức và không thể đăng nhập lại\n- Họ bị xóa khỏi tất cả danh sách phân công\n- Các nhiệm vụ đang chờ vẫn còn — hãy phân công lại chúng\n\n## Phân công lại nhiệm vụ đang chờ\n\n1. Vào trang hồ sơ của người dùng\n2. Nhấn **Phân công lại N nhiệm vụ đang chờ**\n3. Chọn người dùng để phân công tất cả nhiệm vụ\n\n## Kích hoạt lại người dùng\n\n1. Vào **Người dùng** — người dùng bị vô hiệu hóa hiển thị là "Không hoạt động"\n2. Nhấn **Hành động → Kích hoạt lại người dùng**\n3. Người dùng có thể đăng nhập lại ngay lập tức',
  'how-to',
  true
),

(
  'Cách sử dụng mẫu quy trình',
  'how-to-use-flow-templates-vi',
  E'# Cách sử dụng mẫu quy trình\n\nBizFlow cung cấp thư viện mẫu quy trình có sẵn mà bạn có thể sao chép và tùy chỉnh.\n\n## Sử dụng mẫu\n\n1. Vào **Quy trình** trong thanh bên\n2. Nhấn nút **Mẫu** (chỉ Quản trị viên)\n3. Duyệt thư viện theo danh mục (HR, Tài chính, IT, Vận hành, Khác)\n4. Nhấn **Dùng mẫu này** — BizFlow sao chép thành bản nháp trong không gian làm việc của bạn\n5. Tùy chỉnh các bước, trường biểu mẫu và quy tắc phân công\n6. Công bố khi sẵn sàng\n\n## Nội dung được sao chép\n\n- Tất cả các bước, kết nối, trường biểu mẫu và điều kiện rẽ nhánh\n- Quy tắc phân công chung (người yêu cầu, quản lý, cấp trên) được giữ lại\n- Quy tắc phân công theo tổ chức cụ thể (email cố định, trưởng phòng) bị xóa để bạn tự đặt\n\n## Lưu ý\n\n- Sao chép mẫu tính vào giới hạn quy trình của bạn\n- Gợi ý mẫu mới tại contact@bizflow.id.vn',
  'how-to',
  true
),

(
  'Cách nhập người dùng hàng loạt qua CSV',
  'how-to-bulk-import-users-vi',
  E'# Cách nhập người dùng hàng loạt qua CSV\n\nThay vì mời từng người dùng một, bạn có thể nhập nhiều người dùng cùng lúc bằng file CSV.\n\n## Các bước\n\n1. Vào **Người dùng → Nhập hàng loạt**\n2. Nhấn **Tải xuống mẫu** để lấy định dạng CSV đúng\n3. Điền vào các cột:\n   - **email** — địa chỉ email của người dùng\n   - **full_name** — tên hiển thị\n   - **role** — `admin` hoặc `user`\n   - **password** — mật khẩu ban đầu (dùng khi invite là `no`)\n   - **invite** — `yes` để gửi email magic link, `no` để tạo tài khoản ngay với mật khẩu đã cung cấp\n4. Tải lên CSV và xem trước (các dòng có vấn đề được đánh dấu đỏ)\n5. Nhấn **Nhập** — kết quả hiển thị thành công hoặc lỗi từng dòng\n\n## Lưu ý\n\n- Nhập hàng loạt tính vào giới hạn người dùng\n- Người dùng với `invite=yes` xuất hiện trong **Lời mời đang chờ** cho đến khi chấp nhận\n- Người dùng với `invite=no` có thể đăng nhập ngay lập tức',
  'how-to',
  true
),

(
  'Tải file đính kèm trong các bước quy trình',
  'file-uploads-in-workflow-steps-vi',
  E'# Tải file đính kèm trong các bước quy trình\n\nCác bước quy trình có thể bao gồm trường tải file để người được phân công đính kèm tài liệu, hình ảnh hoặc file khác.\n\n## Tải file lên\n\n1. Mở nhiệm vụ có chứa trường tải file\n2. Nhấn vào vùng tải lên hoặc nút chọn file\n3. Chọn file từ máy tính (tối đa 10 MB)\n4. File được tải lên ngay lập tức\n5. Gửi bước khi bạn đã xong\n\n## Xem file đã tải lên\n\nCác file đã tải lên từ các bước đã hoàn thành hiển thị trong chế độ xem lịch sử bước. Nhấn tên file để tải xuống. Link tải xuống hết hạn sau 60 giây vì lý do bảo mật, nhưng bạn có thể nhấn lại để lấy link mới.\n\n## Xuất file đính kèm\n\nQuản trị viên có thể xuất danh sách tất cả file đã tải lên:\n\n1. Vào **Quản trị → Phiên**\n2. Nhấn **Xuất → CSV Đính kèm**\n3. CSV bao gồm metadata file và link tải xuống có hiệu lực 7 ngày',
  'how-to',
  true
),

-- ── TECHNICAL ─────────────────────────────────────────────────────────────────

(
  'Hiểu về thông báo',
  'understanding-notifications-vi',
  E'# Hiểu về thông báo\n\n## Thông báo trong ứng dụng\n\n**Biểu tượng chuông** trên thanh trên cùng hiển thị số thông báo chưa đọc.\n\n- Nhấn chuông để xem 20 thông báo gần nhất\n- Nhấn thông báo để đánh dấu đã đọc và điều hướng đến trang liên quan\n- Nhấn **Đánh dấu tất cả đã đọc** để xóa huy hiệu\n\n## Các loại thông báo\n\n| Loại | Khi nào xuất hiện |\n|------|------------------|\n| Bước được phân công | Một bước quy trình được phân công cho bạn |\n| Quy trình hoàn thành | Quy trình bạn khởi động đã hoàn thành |\n| Nhắc nhở SLA | Bước bạn phụ trách sắp đến hạn hoặc đã quá hạn |\n| Bước bị leo thang | Một bước dưới sự quản lý của bạn đã bị leo thang |\n\n## Thông báo qua email\n\n- **Bước được phân công**: email khi nhiệm vụ mới được phân công cho bạn\n- **Quy trình hoàn thành**: email khi quy trình bạn khởi động kết thúc\n- **Tóm tắt SLA hàng ngày**: email liệt kê các nhiệm vụ quá hạn và sắp đến hạn\n- **Leo thang**: quản lý của bạn nhận email nếu một bước của bạn quá hạn đáng kể',
  'technical',
  true
),

(
  'Xử lý khi bước quy trình bị treo hoặc lỗi',
  'workflow-step-stuck-or-error-vi',
  E'# Xử lý khi bước quy trình bị treo hoặc lỗi\n\n## Bước đang chờ nhưng không tiến triển\n\n1. Vào **Quản trị → Phiên** và tìm phiên quy trình\n2. Mở bảng chi tiết — bước hiện tại hiển thị người được phân công\n3. Nếu người được phân công bị vô hiệu hóa, nhiệm vụ của họ cần được phân công lại\n4. Vào **Người dùng → (hồ sơ người dùng) → Phân công lại nhiệm vụ đang chờ**\n\n## Quy trình ở trạng thái Lỗi\n\nLỗi thường có nghĩa là không thể phân công bước. Nguyên nhân phổ biến:\n- Người dùng được phân công đã bị vô hiệu hóa\n- Quy tắc phân công trỏ đến phòng ban không có thành viên\n- Người được phân công theo email cố định đã bị xóa khỏi không gian làm việc\n\nĐể điều tra:\n1. Vào **Quản trị → Phiên**\n2. Mở phiên bị lỗi\n3. Nhật ký sự kiện ở cuối bảng chi tiết hiển thị mô tả lỗi\n\nSửa vấn đề cơ bản, sau đó khởi động lại phiên mới.\n\n## Liên hệ hỗ trợ\n\nNếu bạn không thể giải quyết vấn đề, hãy gửi email đến contact@bizflow.id.vn với tên quy trình và ID phiên.',
  'technical',
  true
),

(
  'Cách cấu hình tính năng AI',
  'how-to-configure-ai-settings-vi',
  E'# Cách cấu hình tính năng AI\n\nQuản trị viên có thể bật, cấu hình và theo dõi việc sử dụng AI từ trang Cài đặt.\n\n## Bật AI\n\n1. Vào **Cài đặt** trong thanh bên\n2. Nhấn tab **AI**\n3. Bật **Bật tính năng AI**\n\n## Chọn nhà cung cấp và mô hình\n\n- **Nhà cung cấp**: Chọn giữa Anthropic (mô hình Claude) và OpenAI (mô hình GPT)\n- **Mô hình**: Sau khi chọn nhà cung cấp, chọn mô hình cụ thể. Mô hình nhỏ hơn/nhanh hơn chi phí thấp hơn mỗi lần gọi; mô hình lớn hơn cho kết quả chi tiết hơn\n\n## Khóa nền tảng vs khóa riêng\n\n- **Khóa nền tảng**: BizFlow cung cấp API key. Mức sử dụng được theo dõi theo hạn mức tín dụng hiển thị trong cài đặt\n- **Khóa riêng**: Dán API key Anthropic hoặc OpenAI của bạn. Các lần gọi AI được tính phí trực tiếp bởi nhà cung cấp đó. Key của bạn được lưu trữ mã hóa\n\n## Xem nhật ký sử dụng\n\nBảng **Nhật ký sử dụng AI** trong Cài đặt → AI hiển thị mọi lần gọi AI của nhóm: ngày, người dùng, tính năng đã dùng, mô hình, số token và chi phí.\n\n## Tắt AI\n\nBật/tắt **Bật tính năng AI**. Tất cả nút và bảng AI sẽ ẩn khỏi tất cả người dùng trong không gian làm việc ngay lập tức.',
  'how-to',
  true
)

ON CONFLICT (slug) DO NOTHING;

SELECT COUNT(*) AS total_articles FROM knowledge_base WHERE is_active = true;
