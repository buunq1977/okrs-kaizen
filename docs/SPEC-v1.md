# SPEC: Ứng dụng quản lý OKR + Kaizen (Ngày – Tuần – Tháng – Năm)

> Tài liệu này dùng để giao cho Claude xây dựng ứng dụng. Phần **§12 Điểm chưa chốt** ghi các giả định mặc định. Claude làm theo giả định đó và làm thành **cài đặt có thể đổi**, không hard-code.

---

## 1. Mục đích

Ứng dụng giúp một người lập kế hoạch và đánh giá theo vòng lặp **OKR (lập kế hoạch, thực thi) → KAIZEN (đo lường, cải tiến)**, ở 4 cấp thời gian: **Ngày, Tuần, Tháng, Năm**. Mỗi cấp liên kết với cấp trên, tick xong việc nhỏ thì % cấp lớn tự cập nhật.

Ứng dụng phải **ép đúng quy trình** (từng bước, từng tiêu chí kiểm tra), không chỉ là bảng ghi chú.

Ngôn ngữ giao diện: **tiếng Việt**.

---

## 2. Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| **O (Objective) / Tiêu điểm** | Mục tiêu chính của một kỳ (1 ngày, 1 tuần, 1 tháng, 1 năm). Mỗi kỳ có đúng 1 O. |
| **KR (Key Result)** | Kết quả then chốt. Cần các KR hoàn thành thì O mới hoàn thành. |
| **KA (Key Action)** | Hành động cụ thể, có ô tick. KA xong thì KR tiến lên, đủ KA thì KR xong. |
| **SMART** | S: tất cả đều hiểu. M: đo lường được. A: khả thi. R: quan trọng nhất. T: thời gian rõ ràng. |
| **Kaizen** | Cải tiến liên tục: đo lường → nguyên nhân → bài học → hành động tiếp theo. |
| **Tô đậm (highlight)** | Đánh dấu việc/nguyên nhân/từ khóa được chọn. Từ khóa nguyên nhân hiển thị **màu đỏ**. |

---

## 3. Chuỗi liên kết các cấp

```
NĂM     O năm
         └─ KR năm = các O THÁNG
THÁNG   O tháng
         └─ KR tháng = các O TUẦN (4–5 tuần)
TUẦN    O tuần
         └─ KR tuần = các O NGÀY (7 ngày)
NGÀY    O ngày
         └─ 3 KR ngày (tối thiểu 3)
              └─ nhiều KA (hành động cụ thể, có ô tick)
```

**Nguyên tắc: O của kỳ nhỏ là KR của kỳ lớn.** KA xong → KR xong → O xong → lên cấp trên.

### Quy tắc mức liên quan (bắt buộc kiểm tra)

| Cấp | Quy tắc | Mức mặc định |
|---|---|---|
| Ngày | Số KR (trong 3 KR ngày) liên quan trực tiếp O ngày | **≥ 1 KR** (cảnh báo nếu chỉ có 1, gợi ý ≥ 2) |
| Tuần | Tỷ lệ O ngày liên quan O tuần | **≥ 60%** (7 ngày → tối thiểu 5 ngày) |
| Tháng | Tỷ lệ O tuần liên quan O tháng | **≥ 60%** (4–5 tuần → tối thiểu 3 tuần) |
| Năm | Tỷ lệ O tháng liên quan O năm | **≥ 60%** (12 tháng → tối thiểu 8 tháng) (giả định) |

- Phần ngưỡng là **cài đặt**, người dùng sửa được.
- Phần ≤ 40% còn lại là việc nền, việc phát sinh, việc cá nhân.
- **"Liên quan"** được đánh dấu thủ công bằng cờ `is_linked_to_parent` khi tạo/sửa, kèm **1 ô lý do bắt buộc**: *"Khi mục này đạt, O cấp trên tiến lên như thế nào, đo bằng gì?"*. Không có lý do thì không cho đánh dấu.
- Không chặn lưu khi chưa đủ ngưỡng. **Hiện cảnh báo đỏ** ở đầu trang và ở bảng tổng quan.

---

## 4. Tiêu chí kiểm tra

### 4.1 Tiêu điểm (O): 6 ô tick

| Ô | Câu hỏi |
|---|---|
| S | Tất cả đều hiểu? |
| M | Đo lường được? |
| A | Khả thi? |
| R | Quan trọng nhất? |
| T | Thời gian rõ ràng? |
| **KR→O** | **Các KR đạt thì O có đạt không?** |

### 4.2 KR: 5 ô tick + 1 câu hỏi kiểm

- 5 ô S-M-A-R-T cho **từng KR**.
- Dòng kiểm ở cuối mỗi khối KR: *"Hoàn thành các KA này thì KR có đạt không? Còn có thể làm gì nữa để KR đạt trọn vẹn?"* → có nút **"+ Thêm KA"** ngay tại đó.

### 4.3 KA
Chỉ cần ô tick hoàn thành. Nội dung viết bằng **động từ**, cụ thể, ai cũng làm theo được (vd: "Đăng ký 5 data").

### 4.4 Quy tắc ứng dụng thực thi
- **Gợi ý cho M:** khi tick M, nhắc nhập **con số/dấu hiệu đo** vào một ô riêng (`metric`). Không có thì cảnh báo "M chưa có số đo".
- **Chặn "Chốt kế hoạch":** chỉ cho nút "Chốt" (khóa kế hoạch kỳ) khi O đủ 6 ô tick, mỗi KR đủ 5 ô tick, và có ≥ 3 KR (ngày). Cho phép bỏ qua có ghi lý do.
- Mỗi KR nên là **kết quả đo được**, KA mới là hành động. Hiện gợi ý nhẹ nếu KR bắt đầu bằng động từ hành động (không chặn).

---

## 5. Quy trình lập OKR (7 bước, theo đúng thứ tự)

Giao diện dạng **wizard từng bước**, bước sau mở khi bước trước đủ nội dung tối thiểu. Áp dụng giống nhau cho Ngày, Tuần, Tháng.

| Bước | Tên | Việc phải làm | Dữ liệu |
|---|---|---|---|
| 1 | **1a. Quan sát: lịch cố định & cam kết** | Ghi việc đã chắc chắn: làm gì, với ai, khi nào, lời hứa, lịch hẹn. Ô tô vàng = không dời được. Có ô Check hoàn thành. | `schedule_items` |
| 2 | **1b. Quan sát: vấn đề, nỗi đau, tồn đọng, cơ hội** | 3 ô: **Công việc/Tài chính**, **Mối quan hệ**, **Thân – Tâm – Trí**. Mỗi mục có ô *"Nếu không làm thì sao?"* (bắt buộc). | `observations` |
| 3 | **2. Phân tích** | Từ danh sách bước 2, **tô đậm** việc đủ điều kiện (nhân duyên) giải quyết ngay trong kỳ này. | cờ `is_selected` |
| 4 | **3. Nguyên nhân lỗi** | Với từng việc đã tô đậm, tìm nguyên nhân gốc. Có 3 dòng gợi ý: **Tham, Sân, Si**. Có câu kiểm: *"Nếu giải quyết nguyên nhân này, vấn đề có hết không?"* | `root_causes` |
| 5 | **Tiêu điểm (O)** | Viết 1 câu mục tiêu, tick 6 tiêu chí (§4.1). | `objective` |
| 6 | **KR1, KR2, KR3…** | Hỏi: "Để O hoàn thành cần những KR nào?" Mỗi KR tick SMART. | `key_results` |
| 7 | **KA dưới mỗi KR** | Hành động cụ thể, có ô tick. | `key_actions` |

**Điểm bắt buộc nhớ trong giao diện:**
- Làm **bước 1 trước bước 2** (biết quỹ thời gian mới chọn được việc khả thi, tức chữ A).
- Ô "Nếu không làm thì sao?" là bộ lọc: cảnh báo nếu hệ quả để trống.
- O phải xử lý **nguyên nhân ở bước 4**, không xử lý triệu chứng.
- Cấp **Ngày** có ≥ 3 KR (mặc định đúng 3, tối đa 4, cài đặt được).
- Cấp **Tuần/Tháng**: số KR **không cố định** (KR tuần = các O ngày, KR tháng = các O tuần). Chọn từ danh sách O cấp dưới, tự lấy % về.
- Cấp **Tuần/Tháng** có thêm **Kiểm chứng 3 chiều** (§7).

---

## 6. Quy trình Kaizen (4 bước)

Nằm ở nửa phải, làm **cuối mỗi kỳ**. Dải đầu trang hiển thị **Tiêu điểm** và **% hoàn thành** lấy tự động từ OKR.

| Bước | Tên | Việc phải làm | Dữ liệu |
|---|---|---|---|
| 1 | **Đo lường** | Hoàn thành bao nhiêu % tiêu điểm kỳ trước? **Số lấy tự động** từ OKR, không cho nhập tay. Có ô đánh giá ngắn. | `measurement` |
| 2a | **Nguyên nhân: Viết nhật ký** | 3 câu hỏi: đã làm gì, kết quả là gì, còn gì nữa không. Chia **Sáng – Chiều – Tối** (ngày). Chỉ ghi sự thật có giờ và số liệu. | `journal` |
| 2b | **Nguyên nhân % tiêu điểm** | Đâu là nguyên nhân dẫn đến kết quả đó (**cả thành công lẫn thất bại**)? Phân tích tới tận cùng, còn gì nữa không? **Bôi đỏ từ khóa** rút ra. | `causes`, `keywords` |
| 3 | **Bài học** | Đúc kết ngắn gọn dễ nhớ, mỗi bài học **gắn với 1 từ khóa đỏ** ở 2b. Kèm ô *"Dấu hiệu nhận biết khi nó xảy ra"* (khuyến nghị). | `lessons` |
| 4 | **Hành động tiếp theo** | Hành động "tưới" hạt giống nguyên nhân đã tô đậm: phát huy thành công, cải tiến thất bại. Tick SMART + tiêu chí thứ 6: **"Đưa được vào OKR kỳ tới để thực thi"**. | `next_actions` |

**Cuối bản Kaizen (câu tự kiểm, chữ đỏ):** *Bản Kaizen đã cụ thể chưa? Bạn hài lòng với nó chưa? Nếu chưa thì chưa hài lòng chỗ nào? Ai có thể giúp mình làm rõ phần này? Liên hệ tham vấn ngay.* → có ô ghi tên người cần liên hệ.

**Quy tắc ứng dụng:**
- Mỗi hành động ở bước 4 có nút **"Chuyển thành KA/KR của kỳ kế tiếp"**, tự tạo mục tương ứng trong OKR kỳ mới (bản nháp).
- Tối đa **3 hành động** mỗi kỳ ngày (cảnh báo nếu vượt, không chặn).
- Kaizen **tuần/tháng** tự tổng hợp từ Kaizen các kỳ nhỏ (hiển thị từ khóa đỏ lặp lại nhiều nhất, bài học trùng), người dùng chỉnh lại chứ không nhập lại từ đầu.

---

## 7. Kiểm chứng (chỉ ở Tuần và Tháng)

3 khối, mỗi khối có hàng 5 ô SMART riêng và nhiều dòng người:

| Khối | Đối tượng |
|---|---|
| **1. Kiểm chứng trên xuống** | Người chịu ảnh hưởng bởi mục tiêu của bạn (Người 01, 02, 03…) |
| **2. Kiểm chứng chéo** | Phòng ban/người khác bị ảnh hưởng |
| **3. Kiểm chứng dưới lên** | Sếp, Thầy, Mentor (xin duyệt hướng đi) |

Mỗi dòng: `tên người`, `đã hỏi ý kiến (tick)`, `ghi chú`. Làm sau khi viết O và KR, trước khi bắt tay làm.

---

## 8. Công thức tính % hoàn thành

```
KA tick → % KR → % O ngày → % O tuần → % O tháng → % O năm
```

| Chỉ số | Công thức mặc định |
|---|---|
| % KR | số KA đã tick / tổng KA của KR |
| % O ngày | trung bình % các KR của ngày |
| % O tuần | trung bình % các O ngày là KR của tuần |
| % O tháng | trung bình % các O tuần là KR của tháng |
| % O năm | trung bình % các O tháng là KR của năm |

- Mặc định **trung bình đơn giản** (các mục ngang nhau). Cho phép gán **trọng số** (`weight`) tùy chọn cho KA/KR, và nếu đặt thì dùng trung bình có trọng số.
- Cài đặt: `chỉ tính phần liên quan O` (chỉ tính mục có `is_linked_to_parent = true`) hoặc `tính tất cả`. Mặc định: **chỉ tính phần liên quan**.
- Hiển thị **cả hai số** nếu bật: "% mục tiêu" (chỉ phần liên quan) và "% tổng" (tất cả).
- Màu dải %: **< 50% đỏ**, **50–79% vàng**, **≥ 80% xanh** (ngưỡng "đạt" mặc định 80%, cài đặt được).
- Tự cập nhật theo thời gian thực khi tick.

---

## 9. Vòng lặp hằng ngày (luồng chính)

```
Cuối ngày D:
  1) Kaizen ngày D  (Đo lường → Nhật ký → Nguyên nhân → Bài học → Hành động)
  2) Lập OKR ngày D+1 (7 bước)    ← Hành động Kaizen đi thẳng vào KA/KR
Cuối tuần:  Kaizen tuần + Lập OKR tuần mới
Cuối tháng: Kaizen tháng + Lập OKR tháng mới
Thứ tự lập kế hoạch: Năm → Tháng → Tuần → Ngày (cấp lớn trước).
```

- Nhắc giờ (nhắc lập Kaizen + OKR, mặc định **20:00 mỗi ngày**, thời lượng gợi ý 20–30 phút).
- Nhắc cuối tuần (CN), cuối tháng.
- Khi lập OKR ngày D+1 mà chưa có Kaizen ngày D, hiện cảnh báo nhẹ.

---

## 10. Màn hình và giao diện

### Bố cục chung
- Mỗi trang **chia đôi**: **Trái = OKRs**, **Phải = KAIZEN** (giống bản Excel gốc).
- Ô tiêu đề màu **vàng nhạt**, ô điền màu trắng, việc cố định tô **vàng đậm**.
- Dải đỏ giữa trang hiển thị **TIÊU ĐIỂM + HOÀN THÀNH + %** (to, nổi bật).
- Chữ nhỏ dưới mỗi tiêu đề = **câu hỏi gợi ý** (hiện dạng placeholder/tooltip).

### Danh sách màn hình

1. **Tổng quan (Dashboard):** % hôm nay, tuần này, tháng này, năm nay. Biểu đồ xu hướng. Cảnh báo quy tắc 60%.
2. **Trang Ngày:** bảng giờ **04h30–22h30** chia 2 cột (sáng/chiều tối), mỗi dòng 30–60 phút, ô Check. 3 khối KR cạnh nhau. Ô Kaizen bên phải.
3. **Trang Tuần:** lưới **Thứ 2 → CN × Sáng/Chiều/Tối**, ngày hiển thị ngày tháng. Các O ngày hiển thị như KR tuần, kèm cờ "liên quan".
4. **Trang Tháng:** 5 bảng **Tuần 01 → 05**, mỗi bảng 7 ngày × Sáng/Chiều/Tối. O tuần hiển thị như KR tháng.
5. **Trang Năm:** 12 tháng, O tháng là KR năm. (Chia theo quý là tùy chọn, xem §12.)
6. **Cây liên kết:** sơ đồ cây Năm → Tháng → Tuần → Ngày → KR → KA, bấm vào để xuống chi tiết, màu theo % hoàn thành.
7. **Lịch sử Kaizen:** tìm theo từ khóa đỏ, thấy từ khóa lặp lại nhiều nhất.
8. **Cài đặt:** các ngưỡng, giờ nhắc, trọng số, khung giờ.

### Yêu cầu trải nghiệm
- Responsive, dùng tốt trên điện thoại (lập Kaizen buổi tối).
- Lưu tự động, không mất dữ liệu khi tắt tab.
- Xuất **PDF/Excel** từng kỳ theo bố cục bản gốc.

---

## 11. Mô hình dữ liệu (đề xuất)

```
Period            { id, type: day|week|month|year, start_date, end_date, status: draft|locked }
Objective         { id, period_id, title, smart: {s,m,a,r,t}, kr_to_o_ok, parent_kr_id?,
                    is_linked_to_parent, link_reason, percent }
KeyResult         { id, objective_id, title, metric, smart: {s,m,a,r,t}, ka_complete_ok,
                    source_objective_id?  // nếu KR này chính là O của kỳ nhỏ hơn
                    is_linked_to_parent, weight?, percent }
KeyAction         { id, key_result_id, title, done: bool, weight? }
ScheduleItem      { id, period_id, date, time_from, time_to, title, people, fixed: bool,
                    done: bool, kr_ref? }
Observation       { id, period_id, category: work_finance|relationship|body_mind_wisdom,
                    content, consequence_if_ignored, is_selected }
RootCause         { id, observation_id, tham, san, si, note, resolve_check: bool }
Validation        { id, period_id, direction: top_down|cross|bottom_up, person, asked: bool,
                    smart:{s,m,a,r,t}, note }
Kaizen            { id, period_id, measured_percent(auto), assessment, journal:[{slot,text}],
                    causes:[{text}], keywords:[{text}], lessons:[{text, keyword_id, signal}],
                    next_actions:[{text, smart:{s,m,a,r,t}, can_go_into_next_okr, converted_to_id?}],
                    satisfied: bool, consult_who }
Settings          { thresholds, reminder_time, weights_enabled, only_linked_percent, ... }
```

Quan hệ: `Objective(day).is_linked_to_parent` + `parent` trỏ tới `KeyResult(week)`. `KeyResult(week).source_objective_id` trỏ ngược về `Objective(day)`. Giữ nhất quán 2 chiều.

---

## 12. Điểm chưa chốt (giả định mặc định cho Claude)

| # | Câu hỏi còn mở | Giả định mặc định | Cài đặt? |
|---|---|---|---|
| 1 | Ngày: ≥ 1 hay ≥ 2/3 KR liên quan O? | **≥ 1 KR** (đúng yêu cầu), cảnh báo nếu chỉ có 1 | Có |
| 2 | "Liên quan" định nghĩa và ai kiểm? | Tự đánh dấu + bắt buộc nhập lý do | Có |
| 3 | Năm: chia theo tháng hay quý? | Theo **tháng** (12 mốc), ngưỡng 60% (≥ 8 tháng) | Có (thêm chế độ quý) |
| 4 | Số KR tuần/tháng không khớp 3 ô trên bản gốc | Số KR **không giới hạn** ở tuần/tháng; ngày tối thiểu 3, tối đa 4 | Có |
| 5 | % trung bình đơn giản hay trọng số? Tính cả việc nền? | Trung bình đơn giản; chỉ tính phần liên quan O | Có |
| 6 | Nghĩa chữ **R** | "Quan trọng nhất trong các việc làm được kỳ này để đạt O" | Chỉ nhãn gợi ý |
| 7 | KR là kết quả đo được hay hành động? | Khuyến khích kết quả đo được (có ô `metric`), không chặn | Có |
| 8 | Ngưỡng "đạt" của Kaizen | **80%** | Có |
| 9 | "Tối thiểu 3 KR" hay "đúng 3 KR"? | Tối thiểu 3, tối đa 4 | Có |
| 10 | Quy tắc dừng khi hỏi nguyên nhân | Dừng ở nguyên nhân **mình có thể thay đổi bằng 1 hành động cụ thể** (hiện làm câu nhắc) | Không |
| 11 | Ô "Sân" trong khung Tham–Sân–Si | Đủ 3 dòng Tham/Sân/Si | Không |
| 12 | Phần Kiểm chứng của bản ngày | **Không có** ở ngày, chỉ tuần/tháng | Có |

---

## 13. Yêu cầu kỹ thuật gợi ý

- **Web app** (React/Next.js + TypeScript) hoặc PWA để dùng được trên điện thoại.
- Lưu trữ: bắt đầu **local-first** (IndexedDB/SQLite), có đăng nhập và đồng bộ đám mây ở giai đoạn sau.
- Tính % chạy ở tầng logic riêng, có **unit test** cho: công thức %, quy tắc 60%, chặn "Chốt kế hoạch".
- Xuất PDF/Excel đúng bố cục.
- Dữ liệu mẫu: nạp sẵn ví dụ §14 để demo.

### Thứ tự xây dựng đề xuất
1. Mô hình dữ liệu và logic tính % (có test).
2. Trang **Ngày**: OKR 7 bước + Kaizen 4 bước.
3. Liên kết Ngày → Tuần, quy tắc 60%.
4. Trang Tuần + Kaizen tuần, Kiểm chứng.
5. Trang Tháng, rồi Năm.
6. Cây liên kết, Dashboard, nhắc giờ, xuất file.

---

## 14. Ví dụ dữ liệu mẫu (ngày 02/12/2024)

**1a. Lịch cố định:** 04h30–06h15 tham gia trại X3K21 làm Mentor · 09h30–11h20 gọi Phonetem Droppii · 16h30–17h00 chạy bộ 5km · 19h00–21h00 lớp TikTok 3 góc K18.

**1b. Vấn đề:**
- *Công việc:* xây hệ thống kinh doanh online tại Droppii, tháng 12 đạt Mentor 1*; tuyển dụng chưa có kênh cá nhân hóa → *Nếu không làm:* trượt mục tiêu Mentor 1*.
- *Mối quan hệ:* kết nối đồng đội, tìm mentor phát triển hệ thống.
- *Thân – Tâm – Trí:* chạy bộ 5km, thiền 1 giờ/ngày, đọc sách 20 phút, học video 30 phút.

**2. Phân tích (tô đậm):** kỹ năng tuyển dụng.

**3. Nguyên nhân:** *Tham:* mong cầu kết quả. *Si:* chưa biết cách làm hiệu quả, chưa thay đổi sau các buổi kaizen.

**Tiêu điểm O:** Hoàn thiện kỹ năng tuyển dụng Data Droppii. Hoàn thành: 73%.

| KR | % | KA |
|---|---|---|
| KR1: Trước, chuẩn bị 100% kịch bản, tâm thái | 100% | Đăng ký 5 data · Đọc lại kịch bản · Xem lại bài học hôm trước |
| KR2: Trong, thực hiện gọi và kaizen từng cuộc gọi 100% | 70% | Thực hiện cuộc gọi · Cùng đồng đội Kaizen kịch bản · Ghi chú cuộc gọi · Đánh giá tỷ lệ đạt |
| KR3: Sau, Kaizen đúc kết bài học ứng dụng | 50% | Đọc lại nhật ký cuộc gọi · Đọc lại Kaizen đồng đội · Đúc kết bài học, hành động tiếp theo · Chăm sóc chốt với PBB |

**Kaizen:**
- *Nhật ký:* 4h30–6h15 khai giảng trại mentor X3 → khởi đầu đầy năng lượng. 9h30–11h20 phonetem cùng đồng đội → chưa hoàn thành, không chiến thắng được thời quen. 16h45–17h2 chạy bộ → rất hào hứng.
- *Nguyên nhân (từ khóa đỏ):* **chưa tập trung** · **mất năng lượng** · **không rõ tiêu điểm** · **bài học thất bại trong kaizen**.
- *Bài học:* Tự tạo năng lượng tích cực. Phân bổ thời gian rõ ràng cho mục tiêu.
- *Hành động tiếp theo:* Xác định mục tiêu SMART cho từng công việc · Phân bổ thời gian hợp lý · Hoàn thiện lộ trình TikTok 3 góc.

---

## 15. Cảnh báo logic cần xử lý trong app (không bỏ qua)

1. **Tự chấm điểm dễ sai:** tick M mà chưa có số đo thì cảnh báo.
2. **KR viết như hành động** làm KA và KR trùng nhau: gợi ý viết lại KR thành kết quả đo được.
3. **Ngưỡng 60% dễ bị lách** bằng cách nhận việc ít liên quan: bắt buộc ghi lý do liên quan.
4. **KA xong ≠ kết quả đạt:** tick hết KA nhưng KR vẫn chưa đạt thì cho phép người dùng chỉnh % KR thủ công, ghi lý do.
5. **Hành động Kaizen phình ra:** giới hạn mềm tối đa 3 hành động/ngày.
6. **Kaizen/OKR làm lúc mệt:** nhắc giờ cố định, đặt thời lượng gợi ý 20–30 phút.

---

## 16. Câu lệnh gợi ý để giao cho Claude

> Hãy đọc kỹ file `OKR_KAIZEN_APP_SPEC.md` và xây dựng ứng dụng theo đúng thứ tự ở §13. Trước hết, tóm tắt lại bạn hiểu gì về chuỗi liên kết Năm → Tháng → Tuần → Ngày → KR → KA và quy tắc 60%. Sau đó làm **giai đoạn 1** (mô hình dữ liệu + công thức % + unit test) và dừng lại cho tôi xem trước khi sang giai đoạn tiếp theo. Mọi ngưỡng ở §12 phải là cài đặt, không hard-code. Giao diện tiếng Việt.

---

## 17. Quyết định đã chốt với Luca (03/11/2026)

Các mục dưới đây bổ sung/ghi đè spec ở trên. Muốn đổi phải hỏi Luca.

| # | Quyết định |
|---|---|
| D1 | **Giữ tầng trên O năm:** Tầm nhìn 5 năm (≤3) + **tối đa 5 mục tiêu ưu tiên** có con số (điểm xuất phát, đích, đơn vị, hạn chót, ≥1 chỉ số hành động). O năm và O tháng gắn vào 1 mục tiêu ưu tiên, kèm lý do. |
| D2 | **Giữ 2 cơ chế kỷ luật, làm cài đặt bật/tắt (mặc định bật):** (a) kế hoạch ngày D tự khoá lúc 22:00 ngày D-1, sửa sau giờ khoá phải ghi lý do; (b) đỏ N ngày liền (mặc định 2) mà chưa viết Bài học thì không thêm KR/KA mới. |
| D3 | **Lưu trữ:** Supabase (đám mây, đăng nhập email + mật khẩu, RLS) thay cho local-first ở §13. |
| D4 | **Nhắc giờ:** banner trong app + file lịch .ics (nhắc hằng ngày). Web app tĩnh không gửi thông báo khi đang tắt. |
| D5 | **Thứ tự giao:** làm giai đoạn 1–2 (logic % có test + trang Ngày đầy đủ), dừng cho Luca dùng thử, rồi mới làm Tuần/Tháng/Năm, Dashboard, cây liên kết, xuất file. |
| D6 | Bảng kế hoạch cũ (v0.1) bị xoá, Luca xác nhận chưa có dữ liệu. Spec cũ lưu ở `docs/SPEC-v0.1.md`. |
| D7 | Màu tiến độ của mục tiêu ưu tiên dùng cùng ngưỡng §8: tỉ lệ thực tế / mức cần đạt theo thời gian, < 50% đỏ, 50–79% vàng, ≥ 80% xanh. |
