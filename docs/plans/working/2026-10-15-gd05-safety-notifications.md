# GĐ5 — Web người dùng: kiểm duyệt chat, báo cáo, chặn, thông báo (WP7)

| Track | Trạng thái | Ngày |
| --- | --- | --- |
| Full (cross-repo, phía client của GĐ5) | Approved (theo Working Plan + TSD backend đã duyệt 15/10) | 2026-10-15 |

Hợp đồng do backend sở hữu — không chép lại ở đây:

- Working Plan backend: `../nexuslive-be/docs/plans/working/2026-10-15-gd05-safety-notifications.md` (WP7, WP10, §11 M4).
- TSD: `../nexuslive-be/docs/plans/technical/2026-10-15-gd05-safety-notifications.md` (§5.1–§5.8 kiểu, REST, WebSocket; §7 mã lỗi).
- Danh mục API đã chạy: `../nexuslive-be/docs/api/README.md` §6B, §6C, §6D (mọi body thành công bọc `{data}`, `202` → `{data:{actionId}}`).
- Spec: NXL-F (kiểm duyệt, báo cáo, chặn), NXL-E (thông báo), NXL-B (chat), NXL-G2 §3.6–3.7 (Studio → Cộng đồng), NXL-D (khóa tài khoản).
- Design: brief `docs/design/2026-10-15-design-brief-gd05.md`, frame pen.dev GĐ5 (Components GĐ5, 03 Chat Mod / người xem, 03b, 03e–03g, 04, 12, 20–26).

## 1. Task Brief

- **Mục tiêu:** web người dùng làm đủ phần WP7 để chạy kịch bản M4: Creator gán Mod → Mod xóa / timeout / ban / ghim, từ
  khóa chặn + chặn link → người xem thấy đúng trạng thái ≤ 1 s; báo cáo; khóa tài khoản → `4003` → màn khóa; người báo
  cáo nhận `REPORT_RESULT`; theo dõi → Go Live → chuông + toast + email; gỡ buổi phát → "Đã bị gỡ".
- **Trong phạm vi:** menu Mod trên tin (Xóa, Timeout 1 phút / 10 phút / 1 giờ / tùy chỉnh ≤ 14 ngày, Cấm có xác nhận, Ghim /
  Bỏ ghim), thẻ người dùng theo quyền, thanh tin ghim, trạng thái bị hạn chế (đếm ngược, tự mở khi hết hạn /
  `user_restored`), `CHAT_CONTENT_BLOCKED` (TERM / LINK), mất quyền Mod; báo cáo 4 đối tượng (modal / bottom sheet, Khách →
  đăng nhập rồi mở lại); chặn (API) / ẩn tin (chỉ phía client, sessionStorage theo tài khoản); `/moderation/:channel`;
  Studio → Cộng đồng (Mod, VIP, từ khóa chặn, chặn link, Bị cấm); chuông + popover + `/notifications` (Tất cả / Chưa đọc,
  đọc, đọc hết, xóa, tải thêm), realtime `user:{id}` (`notification` upsert theo id, `unread_count`), toast live ≤ 1 / 10 s,
  `/settings/notifications`, `/notifications/unsubscribe?token=`, `/settings/privacy`; khóa tài khoản (đóng `4003`, mã
  `ACCOUNT_LOCKED`) → trang hệ thống có hạn / vĩnh viễn; kênh tạm ngưng → hồ sơ + trang xem; buổi phát bị gỡ; HLS có chữ
  ký: dùng đúng URL của phiên xem, 403 → mở lại phiên một lần.
- **Ngoài phạm vi:** trang admin (WP8, `nexuslive-admin`), email (backend), push / digest / quiet hours, held-for-review.
- **Giả định:** mute "giữ theo người dùng" = sessionStorage khóa theo id tài khoản (design: chỉ tab hiện tại); số chưa đọc lấy
  từ notification-svc (`/v1/me.unreadNotifications` giữ 0, NE-Q1); toast dùng `sonner` có sẵn (vị trí dưới phải /
  trên cùng mobile); trang `/moderation/:channel` dùng `handle`.
- **Không thêm thư viện.**

## 2. Khu vực bị ảnh hưởng

| Khu vực | File / thư mục | Thay đổi |
| --- | --- | --- |
| Realtime | `src/lib/realtime/client.ts` | Sau `4003`, đổi danh tính (đăng xuất) được kết nối lại |
| Chat | `src/features/chat/{types,lib,hooks,components}` | Kiểu + parse sự kiện `delete`, `user_cleared`, `user_restored`, `pin`, `unpin`, snapshot `room.pinned`, `me.restriction`, `me.canModerate`, `blockLinks`; reducer; menu Mod, thẻ, ghim, khóa |
| Mới | `src/features/moderation/` | API chat-svc / identity / safety, quyền hiển thị, thời lượng, lỗi, store mute + report, panel Mod / VIP / từ khóa / bị cấm, trang kiểm duyệt, quyền riêng tư, modal báo cáo |
| Mới | `src/features/notifications/` | API, parse, câu chữ theo loại, cache trung tâm, chuông, popover, trang, toast, cài đặt, hủy nhận |
| Mới | `src/features/settings/` | Khung Cài đặt (Hồ sơ · Tài khoản & bảo mật · Thông báo · Quyền riêng tư) |
| Studio | `studio-layout.tsx`, `community-page.tsx` | Mục "Cộng đồng", banner kênh tạm ngưng |
| Xem / hồ sơ / player | `watch/`, `channels/profile-page.tsx`, `player/hooks/use-hls.ts`, `streams/hooks/use-playback.ts` | Gỡ buổi phát, không còn khả dụng, kênh tạm ngưng, ⋯ Báo cáo, gia hạn URL có chữ ký |
| Hệ thống / auth | `system/`, `auth/` | Màn khóa có hạn / vĩnh viễn, `4003` → trang khóa, pending action `report` |
| i18n | `src/locales/{vi,en}/{notifications,moderation}.json` + bổ sung | Namespace mới |

Luồng cũ có thể vỡ: chat GĐ3 (snapshot / sự kiện thêm trường), phát HLS (URL ký), Shell (chuông, menu avatar), Cài đặt
tài khoản (vào khung mới), Studio nav, E2E GĐ1–GĐ4.

## 3. Các bước

1. Kiểu + parse + logic thuần (unit test), locale vi / en.
2. Thông báo: chuông, popover, trang, realtime, toast, cài đặt, hủy nhận.
3. Chat Mod + thẻ + ghim + trạng thái bị hạn chế + báo cáo + chặn / ẩn.
4. Studio → Cộng đồng, `/moderation/:channel`, `/settings/privacy`, menu avatar.
5. Khóa tài khoản, kênh tạm ngưng, gỡ buổi phát, HLS có chữ ký.
6. E2E `m4-moderator`, `m4-notifications`, `takedown`; chạy lại toàn bộ E2E; chụp màn hình so với design.

## 4. Kiểm tra

- [x] `pnpm lint`, `tsc -b`, `vitest`, `pnpm build`.
- [x] Stack cục bộ (`FRESH=1 /home/claude/stack/up.sh`) + E2E mới + toàn bộ E2E cũ, chạy lại spec chập chờn 2–3 lần.
- [x] Ảnh chụp 1440 / 375 các màn chính so với outline pen.dev.

## 5. Tiêu chí hoàn thành

Theo §11 Working Plan backend (phần web): mọi người xem thấy tin bị xóa / bị hạn chế ≤ 1 s, B thấy "Bạn bị tạm khóa chat
đến …" / "Bạn bị cấm chat trong kênh này"; ghim hiện cho mọi người; "SPẢM" / "abc.xyz" → thông báo chặn, Mod gửi được;
khóa 24 h → người bị khóa thấy màn khóa / bị ngắt `4003`; người báo cáo nhận "Báo cáo của bạn đã được xử lý"; Go Live → chuông
tăng ≤ 5 s + toast + email; gỡ buổi phát → "Buổi phát đã bị gỡ do vi phạm quy định".
