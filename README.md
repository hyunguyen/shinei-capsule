# ShinEi’s Capsule

Trang web bộ sưu tập nắp chai, dựng theo bản Figma handoff. Dữ liệu đọc trực tiếp từ Google Sheet **"ShinEi’s Capsule Database"**, nên bạn sửa sheet là web tự cập nhật (tải lại trang là thấy).

## Cấu trúc

| File | Nội dung |
|---|---|
| `index.html` | Khung trang: nav, hero, thanh tìm kiếm, lưới nắp, footer, popup |
| `styles.css` | Toàn bộ giao diện, token màu/font lấy từ Figma; 3 breakpoint ≥1280 / 768–1279 / <768 |
| `app.js` | Đọc sheet, tìm kiếm, bộ lọc, phân trang, popup chi tiết |
| `config.js` | **File duy nhất bạn cần sửa**: ID sheet, tên cột, ngày bắt đầu sưu tầm, link liên hệ |
| `data/snapshot.js` | Bản sao dữ liệu (918 nắp), chỉ dùng khi không tải được sheet |
| `assets/` | Logo, ảnh nền, ảnh placeholder, ảnh "not found" (xuất từ Figma) |

## Bước 1 — Chia sẻ Google Sheet

Mở sheet → **Chia sẻ** → *Quyền truy cập chung*: **Bất kỳ ai có đường liên kết** → **Người xem**.
Trang chỉ đọc tab `Cap listing` và `Country`, không đọc được gì khác ngoài những gì đã chia sẻ.

## Bước 2 — Xem thử trên máy

Mở terminal trong thư mục này rồi chạy:

```bash
python3 -m http.server 8000
```

Sau đó vào http://localhost:8000. (Mở trực tiếp file `index.html` cũng được, nhưng chạy server là chắc nhất.)

## Bước 3 — Đăng lên mạng (miễn phí)

**Cách nhanh nhất – Netlify Drop:** vào https://app.netlify.com/drop, kéo cả thư mục `nap-chai` vào là xong.

**GitHub Pages:** tạo repo mới → upload toàn bộ file trong thư mục → *Settings → Pages* → Source: `main` / root → đợi 1–2 phút là có link `https://<tên-bạn>.github.io/<repo>/`.

## Thêm ảnh nắp chai

Điền link ảnh vào cột **Image** của tab `Cap listing`. Hỗ trợ:
- Link ảnh trực tiếp (`https://…/cap.jpg`)
- Link chia sẻ Google Drive (`https://drive.google.com/file/d/…/view`). Ảnh cũng phải để chế độ *Bất kỳ ai có đường liên kết*.

Nắp nào chưa có ảnh (hoặc link lỗi) sẽ tự hiện ảnh placeholder ShinEi.

## Tuỳ chỉnh thường gặp (trong `config.js`)

- `collectingSince`: ngày bắt đầu sưu tầm. Số "Days collecting" được tính từ ngày này đến hôm nay.
- `columns`: nếu bạn đổi tên cột trong sheet, sửa tên tương ứng ở đây.
- `pageSize`: số nắp hiện trước khi bấm "Show more" (mặc định 24 = 4 hàng desktop).
- `nav.myStory`: điền link khi có trang My story.

## Hành vi theo spec Figma

- Sắp xếp mặc định theo ID.
- Tìm kiếm trên brand, country, product type, visual tag (hình minh hoạ, màu), text on the cap, note, ID. Gõ không dấu vẫn ra ("danh thanh" → "Đảnh Thạnh").
- Bộ lọc: mỗi loại chọn 1 giá trị, bấm lại để bỏ chọn. Tuỳ chọn xếp theo số nắp nhiều nhất rồi theo ABC. Product type hiện tối đa 12 chip; Brand/Country hiện tối đa 7, nếu nhiều hơn thì hiện 5 kèm "View more"/"View less".
- Nút "View result" hiện số kết quả trước khi áp dụng; "No result" nếu không có nắp nào.
- Bộ lọc và từ khoá được giữ trên URL, nên có thể gửi link một danh sách đã lọc cho bạn bè.
