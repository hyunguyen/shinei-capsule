// =====================================================================
//  CẤU HÌNH — bạn chỉ cần sửa file này
// =====================================================================
window.CONFIG = {
  // Google Sheet chứa dữ liệu. Sheet cần chia sẻ
  // "Bất kỳ ai có đường liên kết → Người xem" thì trang mới đọc được.
  sheetId: "1lmYvjIYvknm0cWumxlbb7-W3Bm_TQeuuZQhAnsRN_ys",
  capSheet: "Cap listing",   // tab chứa danh sách nắp
  countrySheet: "Country",   // tab chứa Country + ISO Code (để hiện cờ)

  // Tên cột (dòng tiêu đề) trong tab "Cap listing"
  columns: {
    id: "ID",
    product: "Product",
    image: "Image",
    brand: "Brand",
    country: "Country",
    visual: "Visual tag",
    text: "Text on the cap",
    note: "Note",
  },

  // Ngày bắt đầu sưu tầm — dùng để tính "Days collecting"
  collectingSince: "2016-10-20",

  // Thứ tự hiển thị: "random" = trộn ngẫu nhiên mỗi lần tải trang, "id" = theo cột ID
  order: "random",

  // Số nắp hiển thị mỗi lần, trước khi bấm "Show more"
  pageSize: 24,

  // Liên kết trên thanh điều hướng và footer
  nav: {
    myStory: "#",           // chưa có trang My story
    contact: "#contact",    // cuộn xuống footer
  },
  contact: {
    email: "toramanhh@gmail.com",
    linkedin: "https://www.linkedin.com/in/anh-huynh-hoa-tram-383368133/",
    behance: "https://www.behance.net/toramanhh",
  },
  footerText: "ShinEi’s Capsule | 2026",
};
