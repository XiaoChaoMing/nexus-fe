# NexusLive Web

Frontend SPA của NexusLive — React + TypeScript + Vite. Kiến trúc và lý do chọn: `../nexuslive-be/docs/architecture/decisions.md` (ADR-007).

## Yêu cầu

- Node.js ≥ 22.12 (Vite 8)
- pnpm

## Lệnh

| Lệnh | Việc |
| --- | --- |
| `pnpm install` | Cài dependency |
| `pnpm dev` | Dev server tại http://localhost:5173 |
| `pnpm build` | Kiểm tra type rồi build ra `dist/` |
| `pnpm typecheck` | Chỉ kiểm tra type |
| `pnpm lint` | oxlint |
| `pnpm test` | Unit test (Vitest): logic player, schema form, `pendingAction`, ánh xạ lỗi, vai trò, i18n |
| `pnpm e2e` | E2E (Playwright) trên stack thật — xem mục E2E |
| `pnpm preview` | Chạy thử bản build |

## Cấu hình

Sao chép `.env.example` thành `.env.local`. Web chỉ gọi một origin (`/v1`, `/hls` qua Vite proxy), nên không cần CORS. Có hai cách nối backend:

**1. Qua Nginx edge (khuyên dùng).** Backend chạy cả stack: `make nxl-up-all` trong `nexuslive-be`. Đặt `VITE_DEV_GATEWAY_URL=http://localhost:8080` — mọi `/v1` và `/hls` đi qua edge, định tuyến giống hệt khi deploy.

**2. Gọi thẳng từng service** (khi chạy service ngoài Docker, không đặt `VITE_DEV_GATEWAY_URL`): Vite tự định tuyến theo tiền tố.

| Tiền tố | Đích (mặc định) | Biến |
| --- | --- | --- |
| `/v1/studio`, `/v1/streams`, `/v1/vods`, `/v1/me/watch-progress`, `/v1/me/continue-watching` | stream-svc `http://localhost:8092` | `VITE_DEV_STREAM_URL` |
| `/v1/channels` | channel-svc `http://localhost:8094` | `VITE_DEV_CHANNEL_URL` |
| `/v1` còn lại (auth, WebSocket sau này) | identity-svc `http://localhost:8090` | `VITE_DEV_IDENTITY_URL` |
| `/hls` | bucket MinIO `http://localhost:9000/nxl-media` | `VITE_DEV_HLS_URL` |

Backend cho cách 2: `make nxl-media-up` trong `nexuslive-be`.

| Biến | Dùng cho | Mặc định |
| --- | --- | --- |
| `VITE_ADMIN_URL` | Liên kết "Trang quản trị" trong menu avatar (chỉ hiện với tài khoản có vai trò `ADMIN`), mở ở tab mới. Web người dùng **không** có route hay code quản trị — quản trị là ứng dụng riêng `nexuslive-admin`. | `http://localhost:5174` |

Import trong `src/` dùng alias `@/` → `src/`.

## Thư viện nền

| Thư viện | Dùng cho | Nơi cấu hình |
| --- | --- | --- |
| Tailwind CSS v4 (`@tailwindcss/vite`) | Styling; token Obsidian Pulse là theme của Tailwind | `src/styles/tokens.css`, `src/index.css` |
| TanStack Query v5 | Dữ liệu từ server (cache, refetch, mutation) | `src/lib/query-client.ts`, `src/app/providers.tsx` |
| Zustand v5 | State phía client dùng chung giữa nhiều màn hình (UI, player, chat) | `src/stores/` |
| shadcn/ui (Radix, `radix-ui`) | Component nền, đã custom theo design system Obsidian Pulse | `components.json`, `src/components/ui/` |
| lucide-react | Icon (outline 20px theo DESIGN.md) | — |
| i18next, react-i18next, i18next-browser-languagedetector | Đa ngôn ngữ (vi mặc định, en) | `src/i18n/`, `src/locales/` |
| Inter, Plus Jakarta Sans (`@fontsource-variable`) | Font chữ thân / tiêu đề, tự host (không gọi Google Fonts) | `src/index.css` |

## Design system

- Nguồn: `../stitch_document_design_interface/obsidian_pulse/DESIGN.md` (+ thiết kế pen.dev).
- Token: `src/styles/tokens.css` — biến shadcn (`--background`, `--card`, `--primary`…) + màu riêng (`live`, `cyan`, `success`, `warning`, `surface`), cỡ chữ (`text-headline-lg|md|sm`, `text-body-lg|md|sm`, `text-label-md|sm`), bo góc (`rounded-control` 6px, `rounded-lg` 8px, `rounded-panel` 10px, `rounded-xl` 12px).
- Không đổ bóng, không blur trang trí: chiều sâu bằng tầng màu (`background` → `surface` → `card`) và viền 1px `border`.
- `accent` của shadcn là **màu nền khi hover**, không phải màu thương hiệu — màu thương hiệu là `primary`.
- Xem toàn bộ component: http://localhost:5173/dev/ui (chỉ bản dev).
- Thêm component: `pnpm dlx shadcn@latest add <tên>` rồi chỉnh class theo DESIGN.md (bỏ `shadow-*`, dùng `bg-card`/`bg-surface`, `border-border`).

Dữ liệu lấy từ API đi qua TanStack Query, không chép vào Zustand. Zustand chỉ giữ state thuần client.

## Đa ngôn ngữ (i18n)

- Chuỗi giao diện nằm trong `src/locales/<ngôn ngữ>/<namespace>.json`. Namespace: `common`, `auth`, `account`, `creator`, `system`, `home`, `watch`, `player`, `studio`, `vod`. **Tiếng Việt là nguồn**: thêm key vào `vi` trước, rồi dịch sang `en`.
- Dùng trong component: `const { t } = useTranslation('studio')` → `t('key.title')`; khác namespace: `useTranslation(['studio', 'common'])` → `t('common:status.live')`. Key được kiểm tra kiểu (`src/i18n/i18next.d.ts`), gõ sai key là lỗi `pnpm typecheck`.
- Chèn giá trị: `"Đã phát {{time}}"` → `t('elapsed', { time })`. Số nhiều: `key_one` / `key_other` + `{ count }` (tiếng Việt chỉ cần `_other`). Định dạng đậm/link trong câu: `<Trans components={{ b: <b /> }} />`.
- Ngoài component (zod schema, ánh xạ mã lỗi API, cảnh báo health…) không gọi `t`: trả về **key** dạng `"ns:path"`, component dịch bằng `useMessage()` (`src/i18n/messages.ts`).
- Ngày giờ, số: dùng `formatDate` / `formatNumber` / `formatDateTime` trong `src/lib/format.ts` (theo ngôn ngữ đang chọn), không viết cứng `'vi-VN'`.
- Đổi ngôn ngữ: nút <kbd>文A</kbd> trên top bar và trang đăng nhập; lựa chọn lưu ở `localStorage` (`nxl.lang`), lần đầu theo ngôn ngữ trình duyệt, mặc định `vi`. `<html lang>` cập nhật theo.
- Thông báo lỗi API lấy theo `error.code` qua `common:errors.<CODE>` (NXL-00 §13) — dùng `errorKey(code)` / `errorKeyOf(err)` trong `src/lib/error-messages.ts`, không hiển thị `error.message`. Mã lạ → `common:errors.fallback`.
- Thêm ngôn ngữ mới: tạo `src/locales/<mã>/*.json` đủ mọi namespace, khai báo trong `src/i18n/resources.ts` (`SUPPORTED_LANGUAGES`, `resources`), thêm tên hiển thị ở `common.json` → `language.<mã>` và locale Intl trong `src/i18n/index.ts`.
- `pnpm test` có bài kiểm tra mọi ngôn ngữ có đúng bộ key của `vi` và giữ nguyên placeholder `{{...}}` / thẻ `<b>`.
- Trang `/dev/ui` (chỉ bản dev) không dịch.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `src/app/` | Router, providers, khung trang (header, sidebar) |
| `src/components/ui/` | Thành phần dùng chung: `Button`, `TextField` |
| `src/lib/` | `api-client` (fetch + Bearer + tự refresh một lần khi 401), `api-error`, `query-client` |
| `src/features/<tên>/` | Theo tính năng: `api/`, `components/`, `hooks/`, `stores/`, `schemas/`, `constants/`, `lib/` |
| `src/features/player/` | Player HLS tự viết (hls.js): DVR, chất lượng, phím tắt, trạng thái (frame 03b); store Zustand riêng cho mỗi player |
| `src/features/streams/` | Gọi stream-svc (TanStack Query, poll trạng thái); phiên xem `POST …/playback` (cổng 18+, `X-NXL-Anon-Id` = `nxl.anonId` cho Khách) |
| `src/features/vod/` | Trang xem lại; tiến độ xem: tài khoản qua `PUT /v1/me/watch-progress` (15 s, tạm dừng, rời trang), Khách ở localStorage, gộp lên tài khoản khi đăng nhập |
| `src/features/watch/`, `studio/`, `home/` | Trang xem live, Studio phát trực tiếp, lưới "Đang phát" |
| `src/features/auth/` | Phiên, modal đăng nhập/đăng ký, `pendingAction`, guard, vai trò (`lib/roles.ts`) |
| `src/features/account/` | Xác minh email, quên/đặt lại mật khẩu, cài đặt tài khoản, banner xác minh |
| `src/features/creator/` | Đơn Creator, Creator CTA |
| `src/features/channels/` | Avatar/tên kênh, nút Follow (GĐ1 chỉ ghi ý định) |
| `src/features/discover/` | Khám phá, Đang theo dõi, Tìm kiếm (khung GĐ1) |
| `src/features/system/` | 404, 500, phiên hết hạn, tài khoản bị khóa, banner offline |
| `src/stores/` | State UI dùng chung toàn app |
| `src/i18n/`, `src/locales/` | Khởi tạo i18next, kiểu key, chuỗi giao diện theo ngôn ngữ |

## Đăng nhập và phiên

- Access token chỉ nằm trong bộ nhớ (`features/auth/stores/auth-store.ts`), không ghi `localStorage`.
- Refresh token là cookie `HttpOnly`, `SameSite=Strict` do identity-svc đặt; khi mở app, `initAuth()` gọi `POST /v1/auth/refresh` để khôi phục phiên. `refresh` và `logout` luôn gửi header `X-NXL-Client: web` (chống CSRF; thiếu header → `403`).
- Sau khi có phiên, Shell lấy `GET /v1/me` (`user`, `roles`, `isCreator`, `channelId`, `unreadNotifications`, `preferences`). Lỗi thì dùng dữ liệu suy ra từ `user` của phiên.
- `401` → refresh **một lần** (các request đồng thời chờ chung) → gửi lại. Refresh lỗi khi đang đăng nhập → về Guest, toast "Phiên đăng nhập đã hết hạn" có nút Đăng nhập; trang đang xem vẫn chạy. Trang riêng tư chuyển `/session-expired?returnTo=…`.
- `403 ACCOUNT_LOCKED` khi refresh → `/account-locked?until=…`; khi đăng nhập → màn "Tài khoản tạm khóa" có thời điểm mở khóa (`details.lockedUntil`).
- `429` ở bất kỳ request nào → toast "Bạn thao tác quá nhanh, thử lại sau N giây" (`details.retryAfterSec`, nếu không có thì header `Retry-After`) — `src/lib/rate-limit-toast.ts`, gắn vào `QueryCache`/`MutationCache`.
- Trang cần đăng nhập đặt trong `<RequireAuth />` (chuyển `/login?returnTo=…`); `/login`, `/register` đặt trong `<GuestOnly />` và vẫn mở trực tiếp được (deep link), sau khi đăng nhập về `returnTo`.
- Validation form (`features/auth/schemas/`) phải khớp với validator của identity-svc. Đăng ký bắt buộc tick "đủ 13 tuổi và đồng ý Điều khoản" (`acceptTerms: true`). Lỗi trùng nhận cả `details.<field> = "TAKEN"` lẫn mã cũ `USERNAME_TAKEN` / `EMAIL_TAKEN`.

### Modal đăng nhập và `pendingAction` (Guest mode)

- Hành động cần tài khoản gọi `useGatedAction()`: đã đăng nhập → chạy ngay; Guest → lưu `pendingAction {type, params, returnTo, createdAt}` vào `sessionStorage` (`nxl.pendingAction`) rồi mở **một** modal hai tab Đăng nhập / Đăng ký (`AuthModal`, Radix Dialog: bẫy focus, `Esc` đóng; < 768px là bottom sheet).
- Modal **không** chuyển trang, nên player bên dưới vẫn phát. Đóng modal → xóa `pendingAction`.
- Đăng nhập/đăng ký thành công → `PendingActionRunner` (trong Shell) đọc **và xóa** action trong một bước rồi chạy đúng một lần. Action quá 30 phút bị bỏ.
- `returnTo` chỉ nhận đường dẫn nội bộ bắt đầu bằng `/`, không `//`, không `/\`, không ký tự điều khiển (`sanitizeReturnTo`). Áp dụng cả cho `/login?returnTo=`.
- Hành động GĐ1:

| Hành động | Guest | Viewer | Creator |
| --- | --- | --- | --- |
| **Phát trực tiếp** (top bar) | modal → sau đăng nhập đi tiếp như cột bên | `/creator/apply` | `/studio/stream` |
| **Follow** (trang xem) | modal → quay lại trang xem | ghi ý định (localStorage `nxl.followIntents`) + toast "sẽ có ở GĐ4", không gọi API | như Viewer |
| **Đang theo dõi** (sidebar, bottom nav) | trang giới thiệu + modal | trạng thái rỗng tới GĐ4 | như Viewer |
| **Hồ sơ** (bottom nav) | modal → `/settings/account` | `/settings/account` | như Viewer |
| **Creator CTA** (cuối trang chủ, ẩn 30 ngày khi bấm ×) | modal (tab Đăng ký) | `/creator/apply` | không hiện |

### Shell (NXL-C)

- Top bar: logo, ô tìm kiếm (GĐ2), **Phát trực tiếp**, chuông (số chưa đọc từ `/v1/me`, 0 tới GĐ5; chỉ khi đăng nhập), ngôn ngữ, avatar. Guest có nút **Đăng nhập / Đăng ký** thay avatar. Không có Messages.
- Menu avatar: Studio (Creator) hoặc "Trở thành Creator", Cài đặt tài khoản, **Trang quản trị** (chỉ khi `roles` có `ADMIN`, mở `VITE_ADMIN_URL`), Đăng xuất (ở lại trang hiện tại nếu trang công khai).
- Sidebar: Trang chủ, Khám phá, Đang theo dõi; Guest thấy **Kênh đề xuất** (lấy từ `GET /v1/streams?status=live`, tối đa 10) + lời mời đăng nhập; đã đăng nhập thấy "Kênh đang theo dõi" (rỗng tới GĐ4). Thu gọn/mở rộng: Guest lưu `localStorage` (`nxl-ui`), đã đăng nhập lưu thêm vào tài khoản (`PATCH /v1/me {preferences.sidebarCollapsed}`).
- Mobile (< 768px): bottom nav 5 mục Trang chủ, Khám phá, Đang theo dõi, Tìm kiếm, Hồ sơ; ẩn khi fullscreen hoặc bàn phím ảo mở; chạm lại tab đang chọn → cuộn lên đầu / làm mới.
- Banner: "Bạn đang offline" (sự kiện `online`/`offline`), xác minh email (khi `emailVerified = false`, có **Gửi lại**, ẩn được trong phiên).
- Kênh: thẻ live, trang xem, trang VOD và Studio hiện tên + avatar kênh (chữ cái đầu nếu chưa có ảnh) từ trường `channel` của stream-svc; `channel = null` (dữ liệu trước GĐ1) thì không hiện.

### Trang

| Route | Trang | API |
| --- | --- | --- |
| `/login`, `/register` | Đăng nhập / đăng ký (cùng form với modal) | `POST /v1/auth/login`, `POST /v1/auth/register` |
| `/verify-email?token=` | Kết quả xác minh (token bị xóa khỏi URL ngay), gửi lại | `POST /v1/auth/verify-email`, `POST /v1/auth/verify-email/resend` |
| `/forgot-password` | Quên mật khẩu (luôn báo "nếu email tồn tại…") | `POST /v1/auth/password/forgot` |
| `/reset-password?token=` | Đặt lại mật khẩu (token bị xóa khỏi URL) → `/login` | `POST /v1/auth/password/reset` |
| `/settings/account` | Hồ sơ (tên hiển thị, ngày sinh nếu chưa có, ngôn ngữ, múi giờ), email, đổi mật khẩu | `PATCH /v1/me`, `POST /v1/me/password` |
| `/creator/apply` | Đơn Creator: form, đang chờ (hủy), bị từ chối (lý do + nộp lại), đã duyệt (chờ tạo kênh → Studio) | `GET /v1/creator-applications/me`, `POST /v1/creator-applications`, `DELETE /v1/creator-applications/{id}`, `GET /v1/me` |
| `/studio/stream` | Studio; `403 NOT_CREATOR` → lời mời nộp đơn (hoặc "kênh đang được chuẩn bị" nếu vừa được duyệt) | `/v1/studio/*` |
| `/browse`, `/following`, `/search` | Khung GĐ1 (Khám phá = danh sách live) | `GET /v1/streams` |
| `/session-expired`, `/account-locked`, `*` (404), lỗi route (500 + Thử lại) | Trang hệ thống | — |

`/account` cũ chuyển sang `/settings/account`.

## Livestream

- `/` lưới "Đang phát", `/live/:streamId` trang xem, `/vod/:vodId` xem lại, `/studio/stream` Studio (cần đăng nhập).
- Xem lại: vị trí đang xem lưu trong trình duyệt (`localStorage` `nxl.vod.<id>`, mỗi 10s và khi rời trang), mở lại thì hỏi "Xem tiếp từ mm:ss?". Lưu theo tài khoản ở GĐ4.
- Studio: sau khi bấm Kết thúc, kênh không phát lại được trong 30s (chặn OBS tự nối lại).
- Player: Auto/720p/480p/360p, tua lại khi đang live (kéo thanh thời gian, `←`/`→` 10s), "Về trực tiếp", Theater (`T`), Fullscreen (`F`), `Space`/`K`, `M`, `↑`/`↓`, `Esc`.
- Trạng thái lấy từ `GET /v1/streams/{id}` mỗi 5s (WebSocket ở GĐ3). Người xem đang lùi vẫn xem tiếp qua lúc gián đoạn / kết thúc.
- Trang player được tải lười (hls.js ~500 kB chỉ tải khi mở trang xem/Studio).

## E2E

`pnpm e2e` chạy trên stack thật qua Vite proxy → cổng vào (`VITE_DEV_GATEWAY_URL=http://localhost:8080`, `make nxl-up-all` trong `nexuslive-be`, có Mailpit và seed dev). Cần `ffmpeg` trong PATH (ffmpeg đóng vai OBS).

Tài khoản seed (identity `NXL_ENV=dev`, `IDENTITY_DEV_SEED=true`), mật khẩu `IDENTITY_DEV_SEED_PASSWORD` — E2E đọc `E2E_SEED_PASSWORD`, mặc định `nexuslive123`:

| Email | Vai trò |
| --- | --- |
| `admin@nexuslive.dev` | ADMIN (duyệt đơn qua API admin / `nexuslive-admin`) |
| `creator@nexuslive.dev` | Creator đã duyệt, có kênh |

| Spec | Kịch bản |
| --- | --- |
| `e2e/m1.spec.ts` | Mốc M1: Guest bấm Phát trực tiếp → đăng ký trong modal (tick điều khoản) → đọc email xác minh từ Mailpit API (`http://localhost:8025`, `E2E_MAILPIT_URL`) → xác minh → nộp đơn Creator → admin seed duyệt qua API → Studio mở, tên kênh hiện → tạo key (+ phát và kiểm tra tên kênh trên trang xem nếu có ffmpeg) |
| `e2e/guest-modal.spec.ts` | Modal + `pendingAction` chạy đúng một lần; `returnTo` ngoài bị bỏ; mobile: bottom nav 5 mục, Hồ sơ của Guest mở bottom sheet |
| `e2e/livestream.spec.ts` | Creator (tài khoản seed) phát, viewer xem, gián đoạn, kết thúc, xem lại |

- Rate limit của cổng vào (auth 10/phút/IP) có thể chặn khi chạy lặp nhiều lần liền; chờ một phút hoặc nới `NXL_EDGE_AUTH_RATE` khi dev.
- Chromium tải kèm Playwright **không giải mã H.264**, nên phần kiểm tra phát hình (chất lượng, DVR) tự bỏ qua.
- Muốn chạy cả phần đó, chỉ định Chrome thật: `E2E_CHROMIUM_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" pnpm e2e`.
- Lần đầu: `pnpm exec playwright install chromium`.
- CI (`.github/workflows/ci.yml`) chỉ chạy lint, typecheck, unit test và build; E2E chạy trên máy vì cần cả stack backend.
