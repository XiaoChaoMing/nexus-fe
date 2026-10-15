# GĐ5 — Web người dùng: kiểm duyệt chat, báo cáo, chặn, thông báo (WP7) — Hoàn thành

| Track | Trạng thái | Ngày |
| --- | --- | --- |
| Full (cross-repo, phía client của GĐ5) | Completed | 2026-10-16 |

- Kế hoạch: [`../working/2026-10-15-gd05-safety-notifications.md`](../working/2026-10-15-gd05-safety-notifications.md).
- Hợp đồng: TSD backend `../nexuslive-be/docs/plans/technical/2026-10-15-gd05-safety-notifications.md` (§5 kiểu / REST /
  WebSocket, §7 mã lỗi); Working Plan backend `../nexuslive-be/docs/plans/working/2026-10-15-gd05-safety-notifications.md`
  (WP7, WP10, §11 M4).

## 1. Đã làm

| Nhóm | Nội dung |
| --- | --- |
| Chat Mod | "⋯" khi hover (desktop) / nhấn giữ 400 ms → bottom sheet (mobile): Xóa, Timeout 1 phút / 10 phút / 1 giờ / tùy chỉnh (≤ 14 ngày), Cấm (xác nhận + lý do), Ghim / Bỏ ghim, Báo cáo, Chặn / Bỏ chặn, Ẩn / Hiện tin. Thẻ người dùng theo quyền (Mod / Creator / người xem), thanh tin ghim (ẩn theo tab), tin bị xóa "Tin nhắn đã bị xóa", `user_cleared` / `user_restored`, mất quyền Mod giữa chừng |
| Trạng thái bị hạn chế | "Bạn bị tạm khóa chat đến 21:30 · còn 9:41" đếm ngược mỗi giây, tự mở khi hết hạn; "Bạn bị cấm chat trong kênh này"; `CHAT_CONTENT_BLOCKED` TERM / LINK đánh dấu tin cho riêng người gửi; `aria-live` đọc một lần khi đổi |
| Báo cáo | Modal (desktop) / bottom sheet (mobile) cho MESSAGE / USER / CHANNEL / STREAM; Khách → đăng nhập ("Đăng nhập để báo cáo") rồi mở lại; `409 REPORT_DUPLICATE` |
| Chặn / Ẩn | Chặn qua API (ẩn tin cả cũ lẫn mới, ở mọi phòng); Ẩn chỉ phía client, sessionStorage `nxl.muted.<userId>` |
| Kiểm duyệt | `/moderation/:channel` (Bị cấm + Từ khóa chặn chỉ đọc theo vai trò), menu avatar "Kênh tôi kiểm duyệt"; Studio → Cộng đồng: Mod, VIP, Từ khóa chặn, Chặn link, Bị cấm (lọc `?type=`, gỡ không hỏi) |
| Thông báo | Chuông + popover (realtime `user:{id}`: `notification` upsert, `unread_count`), `/notifications` (Tất cả / Chưa đọc, đọc, đọc hết, xóa, tải thêm, nhóm theo ngày), toast live ≤ 1 / 10 s, `/settings/notifications` (lưu ngay), `/notifications/unsubscribe?token=` (không cần đăng nhập, xóa token khỏi URL) |
| Cài đặt | Khung Cài đặt (Hồ sơ · Tài khoản & bảo mật · Thông báo · Quyền riêng tư), `/settings/privacy` (danh sách đã chặn) |
| Khóa / tạm ngưng / gỡ | `4003` hoặc `ACCOUNT_LOCKED` → `/account-locked` (có hạn / vĩnh viễn, ngày mở khóa); kênh tạm ngưng → hồ sơ + trang xem + banner Studio; buổi phát bị gỡ → "Buổi phát đã bị gỡ do vi phạm quy định" tại chỗ, mở lại → "Nội dung này không còn khả dụng" |
| HLS có chữ ký | Phát đúng URL `/hls/t/{exp}/{md5}/…` của phiên xem; 403 → mở lại phiên một lần (live + VOD) |
| i18n | Namespace mới `notifications`, `moderation` (vi + en) + bổ sung `chat`, `auth`, `watch`, `channel`, `studio`, `common` |

Không thêm thư viện. Không sửa repo backend / admin / docs.

## 2. Kiểm tra

- `pnpm lint` sạch; `tsc -b` sạch; `vitest` 34 file / 352 test pass; `pnpm build` pass.
- E2E mới: `m4-moderator`, `m4-notifications` (chuông tăng sau 157–275 ms kể từ khi buổi phát LIVE), `takedown` (màn
  "Đã bị gỡ" sau 0,66–1 s) — mỗi spec pass ≥ 3 lần (riêng lẻ + 2 lượt toàn bộ).
- Toàn bộ E2E: 15/15 pass (15,6 phút); `m3` được chỉnh chế độ chậm 30 s (máy 2 CPU tải cao làm các bước vượt cửa sổ 10 s) và pass
  3/3 lần chạy riêng; `livestream` khớp URL HLS có chữ ký.
- Sửa hiệu năng: context kiểm duyệt chat ổn định giữa các lần render (trước: mỗi cập nhật phòng render lại mọi dòng
  chat — 440 so với 54 lần render dòng trên 12 tin).
- Ảnh chụp 1440 / 375: chuông + popover, `/notifications`, cài đặt thông báo, quyền riêng tư, hủy nhận, menu Mod + thẻ,
  trạng thái bị hạn chế, Studio → Cộng đồng, `/moderation/:channel`, màn khóa, buổi phát bị gỡ.

## 3. Lệch so với design

- Toast dùng `sonner` toàn cục (dưới phải / trên cùng mobile), không neo theo cột chat.
- "⋯" của mục thông báo trên mobile là dropdown, không phải bottom sheet; Timeout tùy chỉnh là popover.
- "Tài khoản & bảo mật" là anchor `#security` trong trang tài khoản hiện có.
- Ngày trên màn khóa theo `Intl` có dấu phẩy ("Thứ Sáu, 16/10/2026").
- Hồ sơ kênh tạm ngưng chỉ có handle (backend không trả hồ sơ, xem §4).
- Chưa kiểm bằng E2E: frame 04 kênh tạm ngưng (cần kênh bị tạm ngưng), gia hạn URL HLS khi 403 (phiên 4 h) — có unit test.

## 4. Vấn đề backend (báo cáo, không sửa)

1. notification-svc `NEW_FOLLOWER` trỏ `/studio/dashboard`; web là `/studio` → thêm redirect phía web.
2. channel-svc `403 CHANNEL_SUSPENDED` không kèm dữ liệu hồ sơ (tên hiển thị, avatar) → trang tạm ngưng chỉ hiện handle.
3. Refresh sau khi Admin khóa trả `401 SESSION_EXPIRED` thay vì `ACCOUNT_LOCKED` → tải lại trang thành Khách (khớp ghi
   chú design, nhưng mất màn khóa sau reload).
4. Thẻ người dùng chat: `createdAt` trả `null`.
