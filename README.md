# Bug Speedrunner

> **Hunt the bug. Beat the clock.**

Bug Speedrunner là web game luyện sửa lỗi lập trình theo phong cách speedrun. Người chơi chọn một challenge, tìm lỗi trong code, sửa trực tiếp trên Monaco Editor và Submit trước khi hết giờ.

Mỗi lượt chơi là một cuộc đua với chính mình và toàn bộ runner trên bảng xếp hạng Firebase.

## Tính năng

- Speedrun với đồng hồ tính đến từng mili-giây.
- Challenge JavaScript, HTML, C++ và C#.
- Mỗi lượt tạo một variant code mới với nhiều lỗi cần xử lý.
- Submit đúng sẽ cộng clear; submit sai hoặc timeout sẽ hiển thị hướng dẫn và chuyển sang bài mới.
- Practice Mode để luyện tập không ảnh hưởng rank.
- Leaderboard realtime gồm runner nhanh nhất và runner có nhiều clear nhất.
- Đăng nhập Email/Password hoặc Google qua Firebase Authentication.
- Profile cloud, lịch sử run và personal best.
- AI Support phân tích bài làm sau mỗi lượt bằng Gemini.
- AI Challenge tạo challenge mới theo ngôn ngữ đang chọn khi đã cấu hình Gemini API Key.
- Rank với icon và hiệu ứng riêng cho GOD và Đế vương.
- Export toàn bộ source thành file ZIP.

## Hệ thống rank

| Rank | Điều kiện |
| --- | ---: |
| Đồng | 0 clear |
| Bạc | 5 clear |
| Vàng | 8 clear |
| Bạch kim | 15 clear |
| Huyền thoại | 25 clear |
| GOD | 40 clear |
| Đế vương | 60 clear |

Rank GOD có màu vàng và tia sét nhỏ trên leaderboard. Rank Đế vương kết hợp tím với xanh mint, đi kèm hào quang và hiệu ứng sao.

## Công nghệ

- HTML5, CSS3 và JavaScript ES6+
- Monaco Editor
- Firebase Authentication
- Cloud Firestore và realtime listeners
- Gemini API cho AI Support
- JSZip và FileSaver.js cho tính năng tải source

Không cần npm, Node.js hoặc bước build. Đây là web app tĩnh, phù hợp để triển khai trên GitHub Pages.

## Chạy dự án

1. Clone repository hoặc tải source về máy.
2. Mở thư mục dự án bằng VS Code.
3. Chạy bằng một static server, ví dụ Live Server trong VS Code.
4. Mở địa chỉ local được cung cấp, sau đó đăng ký hoặc đăng nhập Firebase.

Không nên mở trực tiếp bằng `file://` vì Firebase Authentication yêu cầu ứng dụng chạy qua `http://` hoặc `https://`.

## Cấu hình Firebase

Xem hướng dẫn chi tiết trong [FIREBASE_NEXT_STEPS.md](FIREBASE_NEXT_STEPS.md).

Trước khi ranked run có thể lưu dữ liệu, cần publish file [firestore.rules](firestore.rules) lên Cloud Firestore database `(default)` và thêm domain triển khai vào Firebase Authentication → Authorized domains.

## Giới hạn bảo mật

Đây là phiên bản browser-scored: challenge và logic chấm điểm được gửi tới trình duyệt. Các biện pháp khóa editor, chặn copy/paste, transaction và Firestore Rules giúp giảm gian lận thông thường nhưng không thể chống tuyệt đối DevTools.

Để xây dựng leaderboard cạnh tranh thực sự, việc chấm điểm cần chuyển sang backend hoặc Cloud Functions server-authoritative. Firebase App Check cũng nên được bật để giảm request giả mạo.

## Tác giả

**Developed by HK1413.**
