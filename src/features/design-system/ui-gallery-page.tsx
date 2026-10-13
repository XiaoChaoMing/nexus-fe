import { useState, type ReactNode } from 'react'
import {
  BellIcon,
  CheckIcon,
  CircleUserRoundIcon,
  HeartIcon,
  MaximizeIcon,
  MessageSquareIcon,
  PauseIcon,
  RadioIcon,
  SearchIcon,
  SettingsIcon,
  Share2Icon,
  UsersIcon,
  Volume2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CopyField } from '@/components/ui/copy-field'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TextField } from '@/components/ui/text-field'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const SURFACES = [
  ['background', '#0F0F10', 'Level 0 — canvas, player'],
  ['surface', '#18181B', 'Level 1 — sidebar, top bar, input, chip'],
  ['card', '#202024', 'Level 2 — card, chat, menu, dialog'],
  ['accent', '#28282D', 'Hover / active fill'],
  ['border', '#2D2D32', 'Hairline 1px'],
] as const

const ACCENTS = [
  ['primary', '#00F59B', 'Electric Pulse — primary action, active tab, scrubber'],
  ['cyan', '#06B6D4', 'Cyan Resonance — VIP, system badge'],
  ['live', '#EF4444', 'Broadcast Live — LIVE tag, destructive'],
  ['success', '#10B981', 'Success'],
  ['warning', '#F59E0B', 'Warning'],
] as const

const TEXT = [
  ['foreground', '#F5F5F5'],
  ['muted-foreground', '#A1A1AA'],
  ['subtle-foreground', '#71717A'],
] as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-headline-md">{title}</h2>
      {children}
    </section>
  )
}

function Swatch({ name, hex, note }: { name: string; hex: string; note?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-10 shrink-0 rounded-lg border border-border" style={{ background: hex }} />
      <div className="min-w-0">
        <div className="text-label-md">
          {name} <span className="font-mono text-subtle-foreground">{hex}</span>
        </div>
        {note && <div className="truncate text-label-sm text-muted-foreground">{note}</div>}
      </div>
    </div>
  )
}

/** Stream preview card exactly as DESIGN.md "Stream Preview Cards" (reference for the redesign). */
function DemoStreamCard() {
  return (
    <article className="group flex flex-col gap-3">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-card">
        <div className="size-full bg-[linear-gradient(135deg,#0b3b2c,#062a3a_60%,#1b1030)]" />
        <Badge variant="live" className="absolute top-2 left-2">
          Trực tiếp
        </Badge>
        <Badge variant="overlay" className="absolute bottom-2 left-2">
          <UsersIcon /> 18.4K
        </Badge>
      </div>
      <div className="flex gap-3">
        <Avatar size="lg" live>
          <AvatarFallback>VN</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="truncate font-heading text-headline-sm group-hover:text-primary">[VCS] Đại chiến GAM vs TS</h3>
          <p className="text-body-md text-muted-foreground">ViperNinja</p>
          <div className="mt-1.5 flex gap-2">
            <Badge variant="tag">Valorant</Badge>
            <Badge variant="tag">Tiếng Việt</Badge>
          </div>
        </div>
      </div>
    </article>
  )
}

function DemoPlayerHud() {
  const [time, setTime] = useState([62])
  const [vol, setVol] = useState([70])

  return (
    <div className="relative aspect-video overflow-hidden rounded-panel border border-border bg-background">
      <div className="absolute top-3 left-3 flex gap-2">
        <Badge variant="live">Trực tiếp</Badge>
        <Badge variant="overlay">
          <UsersIcon /> 34,218 người xem
        </Badge>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(transparent,rgba(15,15,16,0.95))] px-3 pt-10 pb-2">
        <Slider value={time} onValueChange={setTime} max={100} aria-label="Thanh thời gian" />
        <div className="mt-2 flex items-center gap-1 text-foreground">
          <Button variant="ghost" size="icon-sm" aria-label="Tạm dừng" className="text-foreground hover:text-primary">
            <PauseIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Âm lượng" className="text-foreground hover:text-primary">
            <Volume2Icon />
          </Button>
          <Slider value={vol} onValueChange={setVol} max={100} className="w-20" aria-label="Âm lượng" />
          <span className="ml-2 text-label-sm tabular-nums text-muted-foreground">03:42:19 / Trực tiếp</span>
          <div className="ml-auto flex items-center gap-1">
            <Badge variant="secondary">1080p60</Badge>
            <Button variant="ghost" size="icon-sm" aria-label="Toàn màn hình" className="text-foreground hover:text-primary">
              <MaximizeIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** /dev/ui — living reference of the Obsidian Pulse design system on shadcn/ui (dev builds only). */
export function UiGalleryPage() {
  const [confirm, setConfirm] = useState(false)
  const [filter, setFilter] = useState('all')

  return (
    <TooltipProvider>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 p-6">
        <header>
          <p className="text-label-sm tracking-wider text-primary uppercase">Design system</p>
          <h1 className="font-heading text-headline-lg">Obsidian Pulse × shadcn/ui</h1>
          <p className="mt-1 max-w-2xl text-body-md text-muted-foreground">
            Dark-first, chiều sâu bằng các tầng màu và đường viền 1px — không đổ bóng, không blur trang trí. Nguồn:
            stitch_document_design_interface/obsidian_pulse/DESIGN.md.
          </p>
        </header>

        <Section title="Màu">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-3">
              {SURFACES.map(([n, h, d]) => (
                <Swatch key={n} name={n} hex={h} note={d} />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {ACCENTS.map(([n, h, d]) => (
                <Swatch key={n} name={n} hex={h} note={d} />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {TEXT.map(([n, h]) => (
                <Swatch key={n} name={n} hex={h} />
              ))}
            </div>
          </div>
        </Section>

        <Section title="Chữ">
          <div className="flex flex-col gap-2">
            <p className="font-heading text-headline-lg">Headline LG 28 — Plus Jakarta Sans</p>
            <p className="font-heading text-headline-md">Headline MD 20 — tên kênh, tiêu đề mục</p>
            <p className="font-heading text-headline-sm">Headline SM 16 — tiêu đề thẻ stream</p>
            <p className="text-body-lg">Body LG 16 — Inter</p>
            <p className="text-body-md">Body MD 14 — nội dung chính</p>
            <p className="text-body-sm">Body SM 13 — tin nhắn chat</p>
            <p className="text-label-sm text-muted-foreground uppercase">Label SM 12 — viewers, uptime, category</p>
          </div>
        </Section>

        <Section title="Nút">
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              <RadioIcon /> Phát trực tiếp
            </Button>
            <Button variant="secondary">
              <HeartIcon /> Theo dõi
            </Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Kết thúc buổi phát</Button>
            <Button variant="live">Báo cáo</Button>
            <Button variant="link">Xem tất cả</Button>
            <Button loading>Đang lưu</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button variant="secondary" size="icon" aria-label="Chia sẻ">
              <Share2Icon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cài đặt">
              <SettingsIcon />
            </Button>
          </div>
        </Section>

        <Section title="Badge & chip">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="live">Trực tiếp</Badge>
            <Badge>Nổi bật nhất</Badge>
            <Badge variant="cyan">VIP</Badge>
            <Badge variant="success">Đã xác minh</Badge>
            <Badge variant="warning">Tạm gián đoạn</Badge>
            <Badge variant="secondary">Offline</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="tag">League of Legends</Badge>
            <Badge variant="overlay">
              <UsersIcon /> 24.8K
            </Badge>
          </div>
          <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v)} spacing={2} aria-label="Lọc">
            {[
              ['all', 'Tất cả'],
              ['esports', 'Esports'],
              ['fps', 'FPS'],
              ['moba', 'MOBA'],
              ['irl', 'IRL'],
            ].map(([v, l]) => (
              <ToggleGroupItem key={v} value={v} variant="chip">
                {l}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Section>

        <Section title="Form">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative self-end">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
              <Input placeholder="Tìm kênh, trò chơi, streamer…" className="pr-16 pl-9" aria-label="Tìm kiếm" />
              <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">Ctrl+K</Kbd>
            </div>
            <TextField label="Tiêu đề" placeholder="Leo rank cùng anh em" hint="0/140" />
            <TextField label="Email" defaultValue="sai@" error="Email không hợp lệ" />
            <CopyField label="Stream key" value="live_xxxxxxxxxxxxxxxxxxxx" secret />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-desc">Mô tả</Label>
              <Textarea id="g-desc" placeholder="Giới thiệu kênh…" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Checkbox id="g-mature" defaultChecked />
                <Label htmlFor="g-mature">Nội dung 18+</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="g-notify" defaultChecked />
                <Label htmlFor="g-notify">Thông báo khi kênh phát</Label>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Thẻ stream, card, avatar">
          <div className="grid gap-6 md:grid-cols-3">
            <DemoStreamCard />
            <Card>
              <CardHeader>
                <CardTitle>Hiệu số phong độ</CardTitle>
                <CardDescription>Card = Level 2 + hairline</CardDescription>
              </CardHeader>
              <CardContent className="text-body-md text-muted-foreground">Không đổ bóng; hover chỉ đổi nền hoặc viền.</CardContent>
            </Card>
            <div className="flex items-center gap-4">
              <Avatar size="sm">
                <AvatarFallback>S</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>TL</AvatarFallback>
              </Avatar>
              <Avatar size="lg" live>
                <AvatarFallback>AK</AvatarFallback>
              </Avatar>
              <Avatar size="xl">
                <AvatarFallback>
                  <CircleUserRoundIcon />
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="about">
            <TabsList>
              <TabsTrigger value="about">Giới thiệu</TabsTrigger>
              <TabsTrigger value="schedule">Lịch phát sóng</TabsTrigger>
              <TabsTrigger value="vods">Video</TabsTrigger>
            </TabsList>
            <TabsContent value="about" className="pt-4 text-body-md text-muted-foreground">
              Chỉ báo tab đang chọn dùng Electric Pulse.
            </TabsContent>
            <TabsContent value="schedule" className="pt-4 text-body-md text-muted-foreground">
              Lịch phát sóng…
            </TabsContent>
            <TabsContent value="vods" className="pt-4 text-body-md text-muted-foreground">
              Video…
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Player HUD">
          <div className="max-w-3xl">
            <DemoPlayerHud />
          </div>
        </Section>

        <Section title="Overlay: menu, tooltip, dialog, toast">
          <div className="flex flex-wrap items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Menu tài khoản</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Minh Streamer</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <RadioIcon /> Studio
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <SettingsIcon /> Cài đặt
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">Đăng xuất</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Thông báo">
                  <BellIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Thông báo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Tin nhắn">
                  <MessageSquareIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tin nhắn</TooltipContent>
            </Tooltip>
            <Button variant="destructive" onClick={() => setConfirm(true)}>
              Mở dialog xác nhận
            </Button>
            <Button variant="secondary" onClick={() => toast.success('Đã lưu cài đặt buổi phát')}>
              <CheckIcon /> Toast
            </Button>
          </div>
          <ConfirmDialog
            open={confirm}
            title="Kết thúc buổi phát?"
            confirmLabel="Kết thúc"
            danger
            onConfirm={() => setConfirm(false)}
            onClose={() => setConfirm(false)}
          >
            OBS sẽ bị ngắt kết nối và bản xem lại được tạo.
          </ConfirmDialog>
        </Section>

        <Section title="Trạng thái tải & trống">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Skeleton className="aspect-video w-full" />
              <div className="flex gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
            <Empty className="border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <RadioIcon />
                </EmptyMedia>
                <EmptyTitle>Chưa có ai đang phát</EmptyTitle>
                <EmptyDescription>Quay lại sau hoặc bắt đầu buổi phát của bạn.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        </Section>

        <Separator />
        <p className="text-label-sm text-subtle-foreground">Trang này chỉ có ở bản dev (import.meta.env.DEV).</p>
      </div>
    </TooltipProvider>
  )
}
