# Face Authentication + Liveness (React + Express + SQL)

## 1) Tính năng của web

- Đăng ký tài khoản với các thông tin:
  - Họ tên
  - Email
  - Số điện thoại
  - Mật khẩu
  - Face ID descriptor (capture từ webcam)
- Đăng nhập 2 lớp:
  1. Xác thực mật khẩu
  2. Xác thực khuôn mặt + liveness detection
- Liveness detection gồm:
  - **Active (theo từng bước)**: cười -> xoay trái -> xoay phải (có khung hướng dẫn giữ mặt trong khung)
  - **Passive**: theo dõi chớp mắt, biến thiên biểu cảm nhỏ, chỉ số hình học/texture proxy của khuôn mặt
- Bảo vệ route bằng JWT:
  - Chưa đăng nhập không vào được trang chính
- Trang chính hiển thị:
  - Họ tên
  - Email
  - Số điện thoại
  - Chức năng đổi mật khẩu

## 2) Công nghệ sử dụng

- Frontend: React + Vite + `face-api.js`
- Backend: Node.js + Express.js + JWT
- Database SQL: Postgres (Neon - free, bền dữ liệu)

## 3) Setup và chạy project

### Bước 1: Cài model cho face-api.js

Tải các file model và đặt vào thư mục `frontend/public/models`:

- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1`
- `face_recognition_model-weights_manifest.json`
- `face_recognition_model-shard1`
- `face_recognition_model-shard2`
- `face_expression_model-weights_manifest.json`
- `face_expression_model-shard1`

Nguồn model: https://github.com/justadudewhohacks/face-api.js/tree/master/weights

### Bước 2: Chạy backend

```bash
cd backend
npm install
copy env.example .env
npm run dev
```

Backend local chạy tại: `http://localhost:5000/api`

### Bước 3: Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend local chạy tại: `http://localhost:5173`

Lưu ý: Frontend có thể cấu hình API bằng biến môi trường `VITE_API_BASE_URL`.

## 4) Các API chính

- `POST /api/auth/register`
- `POST /api/auth/login/password`
- `POST /api/auth/login/face`
- `GET /api/users/me` (Bearer token)
- `PATCH /api/users/me/password` (Bearer token)

## 5) Ghi chú

- Phần passive với "độ nhăn da" trên webcam browser chỉ là xấp xỉ (texture proxy), không chính xác bằng camera IR/3D chuyên dụng.
- Khi đưa lên production nên bổ sung:
  - Anti-spoofing model chuyên dụng
  - Risk engine
  - Device fingerprinting
  - Rate limiting
  - HTTPS bắt buộc

## 6) Deploy FREE (Neon + Render + Vercel)

### 6.1) Tạo Postgres free trên Neon

- Tạo account Neon
- Create project -> lấy `DATABASE_URL` (connection string)
- Neon thường yêu cầu SSL (`sslmode=require`) -> để nguyên trong URL

### 6.2) Deploy Backend lên Render (free)

1. Đưa code lên GitHub (repo chứa cả `backend` và `frontend`)
2. Trên Render: New -> Web Service -> connect GitHub repo
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
4. Environment variables (Render):
   - `DATABASE_URL`: (dán từ Neon)
   - `JWT_SECRET`: chuỗi dài, random
   - `FRONTEND_ORIGIN`: URL Vercel của bạn (ví dụ `https://your-app.vercel.app`)
   - `PORT`: `5000` (Render tự set PORT; giữ cũng được)

Test: mở `https://<render-service>/api/health`

### 6.3) Deploy Frontend lên Vercel (free)

1. Import GitHub repo vào Vercel
2. Settings:
   - **Root Directory**: `frontend`
3. Environment variables (Vercel):
   - `VITE_API_BASE_URL`: `https://<render-service>/api`
4. Deploy

### 6.4) Lưu ý khi dùng free tier

- Render free có thể "sleep": request đầu tiên sau một thời gian sẽ chậm vài giây.
- Neon free vẫn bền dữ liệu, nhưng nên backup định kỳ nếu dự án quan trọng.

## 7) Deploy bằng Docker (tùy chọn)

Nếu máy bạn có Docker, bạn có thể chạy local bằng `docker-compose.yml` và trỏ `DATABASE_URL` về Neon.
