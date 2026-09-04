# Bug Speedrunner Firebase V2 — việc cần làm sau khi tải ZIP

## 1. Firebase Authentication
Vào **Firebase Console → Authentication → Sign-in method**:

- Enable **Email/Password**.
- Enable **Google**.
- Vào **Authentication → Settings → Authorized domains** và thêm domain GitHub Pages của game.
- Nếu test bằng localhost và Firebase project của bạn không tự có `localhost`, thêm `localhost`.

## 2. Firestore Rules — BẮT BUỘC
Vào **Firestore Database → Rules**, thay toàn bộ Rules hiện tại bằng file `firestore.rules` trong ZIP rồi bấm **Publish**.

V2 Rules:
- chỉ user sở hữu UID mới ghi được profile của mình;
- run chỉ được tạo bởi chính UID đó;
- run không được update/delete;
- run timestamp phải là server request time;
- cập nhật stats và tạo run phải nằm trong cùng transaction;
- Rules dùng `getAfter()` để đối chiếu stats với run vừa tạo;
- run documents không còn public read.

## 3. Không cần làm
- Không cần npm.
- Không cần Node.js cho web project.
- Không cần Firebase CLI.
- Không cần tạo thêm Firestore database.
- Không cần Firebase Hosting; GitHub Pages là đủ.

## 4. Test bắt buộc trước khi public
1. Register bằng Email/Password.
2. Logout → login lại.
3. Google login.
4. Vào Speedrun → Start Match → Submit một clear.
5. Kiểm tra `users/{uid}` và `runs/{runId}` trong Firestore.
6. Mở game bằng browser/profile khác → kiểm tra leaderboard realtime.
7. Thử một fail/timeout → không được cộng clear.
8. Thử đổi tên profile → phải lưu được.
9. Refresh trang giữa các route → không mất session Firebase.

## 5. Anti-cheat nâng cấp thêm nếu muốn cạnh tranh nghiêm túc
V2 đã siết Firestore rất nhiều nhưng vẫn **không thể biến browser-scored challenge thành anti-cheat tuyệt đối**. Người dùng vẫn có thể mở DevTools vì challenge và checker nằm ở client.

Nếu sau này muốn leaderboard có tính cạnh tranh thật sự, bước tiếp theo là đưa việc chấm điểm vào một backend/server-authoritative function. Firebase App Check cũng nên được cân nhắc để giảm abuse từ client không tin cậy.
