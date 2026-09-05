# Bug Speedrunner

> **Hunt the bug. Beat the clock.**

Bug Speedrunner là web game luyện sửa lỗi lập trình theo phong cách speedrun. Người chơi chọn một challenge, tìm lỗi trong code, sửa trực tiếp trên Monaco Editor và Submit trước khi hết giờ.

Mỗi lượt chơi là một cuộc đua với chính mình và toàn bộ runner trên bảng xếp hạng Firebase.

## Tính năng

- Speedrun với đồng hồ tính đến từng mili-giây.
- 16 challenge nền trải trên JavaScript, HTML, C++ và C#; procedural mutation có thể ghép nhiều lỗi độc lập trong từng run.
- Mỗi Start Match tạo một procedural board mới: challenge nền, seed, mode, tổ hợp lỗi, tên biến và độ lệch dòng lỗi đều có thể thay đổi; kết quả thắng/thua/timeout/reset đều chuẩn bị board mới.
- Submit đúng sẽ cộng clear; submit sai hoặc timeout sẽ hiển thị hướng dẫn và chuyển sang bài mới.
- Practice Mode để luyện tập không ảnh hưởng rank.
- Leaderboard realtime gồm runner nhanh nhất và runner có nhiều clear nhất.
- Đăng nhập Email/Password hoặc Google qua Firebase Authentication.
- Profile cloud, lịch sử run và personal best.
- AI Support phân tích đúng run vừa hoàn thành; bảng mới không làm AI nhầm sang bài kế tiếp.
- AI Challenge tạo challenge mới theo ngôn ngữ đang chọn khi đã cấu hình Gemini API Key.
- Rank với icon và hiệu ứng riêng cho GOD và Đế vương.
- Export toàn bộ source thành file ZIP.


### Procedural Arena
- Seed mới cho từng run.
- 1–n mutation operator được chọn theo PRNG seeded, thay vì chỉ đổi variant cố định.
- Identifier salt và diagnostic header làm code shape khác giữa các lượt.
- Bug lines được tính lại từ solution/broken sau khi sinh board, nên hướng dẫn failure hiển thị dòng thực tế của run.
- Hint, session streak, live feed và sound feedback là các lớp gameplay UI mới.
- Workspace dùng grid co giãn, toolbar có overflow có kiểm soát và bottom panel có thể thu gọn để Monaco không bị lấn diện tích.

## Hệ thống rank

| Rank | Điều kiện |
| --- | ---: |
| Đồng | 0 clear |
| Bạc | 5 clear |
| Vàng | 8 clear |
| Bạch kim | 15 clear |
| Kim cương | 20 clear |
| Huyền thoại | 25 clear |
| Thăng hoa | 32 clear |
| GOD | 40 clear |
| Bất tử | 55 clear |
| Orbit | 72 clear |
| Đế vương | 90 clear |

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

## V5 Rank Audio

Optional rank music is loaded from the local project folder:
- `assets/audio/sovereign.mp3` — Emperor / Đế vương profile and Rank Review.
- `assets/audio/orbitsong.mp3` — Orbit profile and Rank Review.

The browser loops the active rank track and stops it when leaving the profile/review. If the files are absent, the rest of the rank UI continues to work normally.

## V5 Security Foundation

The V5 Admin foundation uses Firebase custom-claim roles for UI gating and Firestore rules for event writes. It is a foundation, not a claim that the browser is trusted: frontend visibility is never treated as authorization; privileged operations must be protected by Firebase Authentication, server-side roles/custom claims, Firestore Rules and trusted backend functions where needed. App Check, re-authentication for sensitive Owner actions and server-side audit logs are recommended for privileged controls.


## V5 Event Forge
- Event Center + per-event leaderboard.
- IShow⚡: 10 consecutive procedural challenges, one continuous 5-minute timer, rising bug pressure, split times, medals and sub-5 title reward.
- Admin lifecycle: Draft/Edit → Publish/Live → Close + final snapshot → Announce → Archive → Duplicate as a new event version.
- Achievement system unlocks titles; titles can be equipped and shown on profile.
- Admin visibility is based on Firebase custom-claim role (`admin`/`owner`); Firestore rules enforce event write access.
