#!/usr/bin/env bash
# ============================================================
#  ตั้งระบบร้านหนังสือให้พร้อมใช้ในเครื่อง (macOS / Linux)
#      bash scripts/setup-local.sh
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

C='\033[36m'; G='\033[32m'; Y='\033[33m'; R='\033[31m'; N='\033[0m'
step() { echo -e "\n${C}[$1] $2${N}"; }
ok()   { echo -e "    ${G}$1${N}"; }
warn() { echo -e "    ${Y}$1${N}"; }
die()  { echo -e "\n${R}หยุด: $1${N}"; exit 1; }

step 1 "ตรวจเครื่องมือที่ต้องใช้"
command -v node   >/dev/null || die "ไม่พบ Node.js — ติดตั้งจาก https://nodejs.org (เลือก LTS)"
ok "Node.js $(node --version)"
command -v docker >/dev/null || die "ไม่พบ Docker — ติดตั้ง Docker Desktop"
docker info >/dev/null 2>&1  || die "Docker ยังไม่ทำงาน — เปิด Docker Desktop รอจนขึ้น Running แล้วรันใหม่"
ok "Docker พร้อมใช้งาน"

step 2 "ติดตั้ง dependency (ครั้งแรกใช้เวลาสักครู่)"
npm install --no-audit --no-fund
ok "ติดตั้งเรียบร้อย"

step 3 "เตรียม Supabase"
if [ ! -f supabase/config.toml ]; then
  npx --yes supabase init
  ok "สร้าง supabase/config.toml แล้ว"
else
  ok "มี config.toml อยู่แล้ว"
fi

step 4 "เปิดฐานข้อมูลใน Docker (ครั้งแรกต้องโหลด image ~2-5 นาที)"
npx --yes supabase start
ok "ฐานข้อมูลทำงานแล้ว"

step 5 "สร้างตารางทั้งหมด + ใส่ข้อมูลตัวอย่าง"
npx --yes supabase db reset
ok "ตารางและข้อมูลพร้อมแล้ว"

step 6 "เขียนไฟล์ .env.local"
STATUS="$(npx --yes supabase status -o env 2>/dev/null || true)"
API_URL="$(echo "$STATUS"  | sed -n 's/^API_URL="\?\([^"]*\)"\?$/\1/p')"
ANON="$(echo "$STATUS"     | sed -n 's/^ANON_KEY="\?\([^"]*\)"\?$/\1/p')"
SERVICE="$(echo "$STATUS"  | sed -n 's/^SERVICE_ROLE_KEY="\?\([^"]*\)"\?$/\1/p')"

if [ -z "$API_URL" ] || [ -z "$ANON" ]; then
  warn "อ่านค่าจาก supabase status ไม่ได้"
  warn "รัน 'npx supabase status' แล้วคัดลอกค่าไปใส่ .env.local เอง (ดู .env.example)"
else
  cat > .env.local <<ENVEOF
# สร้างอัตโนมัติโดย scripts/setup-local.sh
# ค่าเหล่านี้เป็นของฐานข้อมูลในเครื่องเท่านั้น ไม่ใช่ของจริง

NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE

# ---------- เติมทีหลังเมื่อพร้อม ----------
PROMPTPAY_ID=
SHOP_NAME=ร้านหนังสือ
SHOP_ADDRESS=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
NEXT_PUBLIC_LIFF_ID=
SLIP_VERIFY_API_KEY=
FLASH_MERCHANT_ID=
FLASH_API_KEY=
ENVEOF
  ok "เขียน .env.local แล้ว"
fi

echo -e "\n${G}============================================${N}"
echo -e "${G} พร้อมใช้งานแล้ว${N}"
echo -e "${G}============================================${N}\n"
echo "  เริ่มเว็บ:  npm run dev"
echo "  เปิด:      http://localhost:3000/admin"
echo ""
echo "  บัญชีทดสอบ"
echo "    อีเมล   : owner@bookshop.local"
echo "    รหัสผ่าน : bookshop1234"
echo ""
echo "  ดูฐานข้อมูล: http://localhost:54323  (Supabase Studio)"
echo ""
echo "  หยุดฐานข้อมูล: npx supabase stop"
echo "  ล้างข้อมูลกลับเป็นค่าเริ่มต้น: npx supabase db reset"
echo ""
