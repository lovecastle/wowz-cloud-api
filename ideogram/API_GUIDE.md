# Hướng dẫn sử dụng API với cURL

## 1. Upload Ảnh
Để tải lên một ảnh từ URL:
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://example.com/your-image.jpg"}'  
```

Phản hồi thành công:
```json
{
  "success": true,
  "uploadId": "your-upload-id"
}
```

## 2. Lấy Caption cho Ảnh
Sau khi upload, sử dụng uploadId để lấy caption:
```bash
curl -X POST http://localhost:3000/api/caption \
  -H "Content-Type: application/json" \
  -d '{"uploadId": "your-upload-id"}'  
```

Phản hồi thành công:
```json
{
  "success": true,
  "caption": "mô tả của ảnh"
}
```

## 3. Tạo Biến Thể Tùy Chỉnh
Tạo biến thể với prompt và style tùy chỉnh:
```bash
curl -X POST http://localhost:3000/api/gencustom \
  -H "Content-Type: application/json" \
  -d '{
    "imageId": "your-upload-id",
    "promptText": "your custom prompt",
    "style_expert": "AUTO"
  }'  
```

Phản hồi thành công:
```json
{
  "success": true,
  "variations": {
    // dữ liệu biến thể
  }
}
```

## 4. Tạo Biến Thể Tự Động
Tạo biến thể tự động từ một ảnh URL:
```bash
curl -X POST http://localhost:3000/api/generate-variations \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://example.com/your-image.jpg"}'  
```

Phản hồi thành công:
```json
{
  "success": true,
  "uploadId": "your-upload-id",
  "caption": "mô tả của ảnh",
  "variations": {
    // dữ liệu biến thể
  }
}
```

## 5. Lấy Thông Tin Hình Ảnh của Người Dùng
Lấy danh sách hình ảnh của một người dùng:
```bash
curl "http://localhost:3000/api/u?user_id=your-user-id&all_privacy=true&filters=everything"
```

Phản hồi thành công:
```json
{
  // thông tin hình ảnh của người dùng
}
```

## Lưu ý
- Thay thế các giá trị mẫu (example.com/your-image.jpg, your-upload-id, your-user-id) bằng giá trị thực của bạn
- Đảm bảo server đang chạy tại localhost:3000 trước khi gọi API
- Tất cả các request đều yêu cầu header Content-Type: application/json
- Các phản hồi lỗi sẽ có format:
```json
{
  "error": "mô tả lỗi"
}
```