# SPEC v3 (NHÁP 2, chờ Luca duyệt): OKR + Kaizen · Tầm nhìn → Năm → Quý → Tháng → Tuần → Ngày

> Thay cho `SPEC.md` (v1 + §17) và spec v2 của Luca (`docs/SPEC-v2-luca.md`) sau khi được duyệt.
> Mọi ngưỡng ở §15 là **cài đặt**, không hard-code. Ngôn ngữ giao diện: tiếng Việt.
> Ký hiệu: **[Giả định]** = mặc định Claude đặt, Luca có thể đổi khi duyệt.

---

## 0. Thay đổi so với v2

| # | Thay đổi | Lý do |
|---|---|---|
| C1 | Ngày/Tuần: **O → 3 KR → KA**. Tháng/Quý/Năm: **O → KR**, KA tuỳ chọn. | Cấp dài đo bằng số, không cần liệt kê hành động. |
| C2 | **Bỏ quy tắc 60%** và cảnh báo đỏ. Thay bằng chỉ số thông tin **"Mức tập trung"** (x/7 ngày phục vụ O tuần). | KR/KA xong chưa chắc O đạt; ép tỉ lệ không giải quyết được điều đó. |
| C3 | Thêm **% O thực tế** (đo trực tiếp O ở Kaizen) bên cạnh **% thực thi** (từ KR/KA). Lệch lớn → gợi ý "KR chọn chưa trúng O". | Sửa đúng gốc của vấn đề ở C2. |
| C4 | Bỏ cờ "KR liên quan O" trong ngày. KR nằm dưới O thì mặc nhiên phục vụ O. Việc nền để ở lịch cố định. | Bớt thao tác, bớt ô lý do. |
| C5 | **Tuần có 3 KR + KA riêng** (giống Ngày). O ngày chọn phục vụ 1 KR hoặc 1 KA tuần. Bỏ "KR tuần = các O ngày". | Đi từ trên xuống. |
| C6 | Tháng/Quý/Năm có **3 O cố định theo 3 mảng**: Công việc/Tài chính · Mối quan hệ · Thân–Tâm–Trí. KR: CV/TC ≥ 3, hai O còn lại 1–2. | Rõ ràng, không quá tải (tối thiểu 5 KR/cấp). |
| C7 | Tháng/Quý/Năm **giữ quan sát → phân tích → nguyên nhân lõi** (Tham–Sân–Si), bỏ lưới giờ. Thay bằng khối tuỳ chọn **"Sự kiện & mốc quan trọng"** (danh sách), tự hiện xuống Tuần/Ngày. Kaizen vẫn là **Kaizen số liệu**. | Không quên lịch hẹn/sự kiện lớn mà không phải giữ lưới trống. |
| C8 | Lịch cố định: tách **Cố định** (không dời, tô vàng) và **Lặp lại** (ngày/thứ/ngày trong tháng). Mỗi ô giờ chứa **nhiều mục**. Mục lặp lại có thể **gắn KR tháng** để tự cộng số. | ★ trước đây mang 2 nghĩa. Đo O Mối quan hệ, O Thân–Tâm–Trí không cần nhập tay. |
| C9 | Nhật ký Kaizen: dạng dòng **Giờ \| Đã làm gì \| Kết quả**, không chia buổi, tự điền từ lịch. | Xem lại việc đã làm trong ngày. |
| C10 | Hiện **% O tuần, % 3 O tháng, % O năm** phía trên tiêu điểm Ngày/Tuần. Tuần có chart. | Luôn thấy cấp trên khi lập cấp dưới. |
| C11 | Mô hình thu nhập dùng **phễu tự cấu hình** (n bước). | Phễu cố định gọi → hẹn → vào hệ thống không dùng được cho nguồn thu khác. |
| C12 | Bỏ màn "Mục tiêu ưu tiên (≤ 5)". **Tầm nhìn + 3 O năm** là nguồn sự thật duy nhất. | Trùng vai. |
| C13 | **Mang sang tự động:** quan sát/nguyên nhân chưa xử lý, lịch lặp lại, dòng nhật ký. Mục tiêu: lập kế hoạch Ngày ≤ 15 phút. | Rủi ro lớn nhất là bỏ cuộc vì nghi thức quá dài. |
| C14 | Nút **"Kiểm tra tiêu điểm"**: hỏi 6 tiêu chí kèm giải thích, có kiểm tự động. | Theo yêu cầu Luca. |
| C15 | Kaizen tháng chỉ sửa kế hoạch tháng. **Kế hoạch năm chỉ sửa ở Quý.** | Xoá mâu thuẫn v2 §8.3 với §11.1. |
| C17 | **Luật điều chỉnh kế hoạch phân loại** (§11.5): thêm/nâng tự do trong trần KR; hạ ≤ 1 lần/KR/quý, cấm nhóm (a); dừng ≤ 1 lần/quý; sửa ngoài buổi rà chờ 48 giờ; vượt giới hạn phải có mentor duyệt. | Linh hoạt khi có cơ hội thật, chặn hạ mục tiêu vì nản. |
| C18 | **Kỳ khởi động 11–12/2026** theo cấu trúc Quý, vào chu kỳ năm chuẩn từ 1–5/1/2027. Lập kỳ ngoài cửa sổ rà vẫn được, ghi "lập muộn x ngày". | Không bỏ trống 2 tháng cuối năm. |
| C19 | **OKR và Kaizen là 2 tab riêng** mỗi cấp, không chia đôi màn hình. Tab Kaizen có phần tóm tắt OKR chỉ đọc ở đầu. Tab mở sẵn: trước giờ nhắc → OKR, sau giờ nhắc → Kaizen; lập kế hoạch kỳ tới → OKR. | Dùng tốt trên điện thoại, vẫn đối chiếu được kế hoạch khi viết Kaizen. |
| C16 | Lưu trữ: Supabase (đang chạy), không local-first. Giữ 2 cơ chế kỷ luật (tự khoá 22:00, khoá khi đỏ nhiều ngày) làm cài đặt. | Quyết định 03/11/2026. |

---

## 1. Mục đích và nguyên tắc

Đi từ **tầm nhìn dài hạn** xuống **việc hôm nay**, và đo ngược từ hôm nay lên tầm nhìn.

- **Vòng ngắn (Ngày, Tuần):** OKR hoạt động + Kaizen nhật ký/nguyên nhân. Mục đích: kỷ luật hằng ngày.
- **Vòng dài (Tháng, Quý, Năm, Tầm nhìn):** OKR bằng số + Kaizen số liệu. Mục đích: kiểm soát tiến độ, chống trì hoãn.

Nguyên tắc:
1. **Từ trên xuống:** lập Tầm nhìn → Năm → Quý → Tháng → Tuần → Ngày. Cấp dưới chọn phục vụ cấp trên. Không cộng ngược cứng nhắc từ dưới lên.
2. **Ép đúng quy trình** bằng thứ tự bước và tiêu chí kiểm tra, không chỉ là sổ ghi chú.
3. **Gợi ý thay vì cấm** ở các liên kết giữa cấp. **Chặn** chỉ ở "Chốt kế hoạch" khi thiếu ô bắt buộc (cho bỏ qua kèm lý do).
4. **Ít nhập lại:** cái gì đã có thì mang sang, người dùng chỉ sửa.

---

## 2. Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| **O / Tiêu điểm** | Mục tiêu chính của kỳ. Ngày, Tuần: 1 O. Tháng, Quý, Năm: 3 O theo 3 mảng. |
| **KR** | Ngày/Tuần: hạng mục để hoàn thành O (đo bằng tick KA). Tháng+: **con số** Từ → Đến, Hạn, Nguồn đo. |
| **KA** | Hành động cụ thể, bắt đầu bằng động từ, có ô tick. Luôn là cấp dưới của **một** KR. |
| **3 mảng** | Công việc/Tài chính (CV/TC) · Mối quan hệ (MQH) · Thân–Tâm–Trí (TTT). |
| **% thực thi** | % tính từ KA/KR đã tick. |
| **% O thực tế** | Mức đạt của chính O, đo trực tiếp ở bước Đo lường của Kaizen. |
| **Mức tập trung** | Số ngày trong tuần có O ngày phục vụ O tuần. Chỉ là thông tin. |
| **Chỉ số kết quả / dẫn trước** | Lagging (cái muốn đạt) / leading (việc làm hằng ngày dẫn tới kết quả). |
| **Nhịp độ chia ngược** | Từ đích tính ra việc phải làm mỗi tuần/ngày (§9). |
| **Kế hoạch cộng dồn** | Số lẽ ra phải đạt tính đến hôm nay. |
| **Tình trạng (TT)** | Thực tế cộng dồn / kế hoạch cộng dồn đến hôm nay. |
| **Phiên bản kế hoạch** | Bản gốc và các bản điều chỉnh, luôn so với bản gốc. |
| **Mục cố định** | Lịch không dời được, tô vàng. |
| **Mục lặp lại** | Lịch tự xuất hiện theo chu kỳ (ngày / thứ trong tuần / ngày trong tháng). |

---

## 3. Chuỗi các cấp và liên kết

```
TẦM NHÌN (3–10 năm)   mục tiêu theo năm + điều kiện kiểm tra
  └─ NĂM      3 O (CV/TC, MQH, TTT) · KR số (CV/TC ≥ 3, MQH/TTT 1–2) · mỗi KR chia 4 mốc quý
      └─ QUÝ  3 O · KR lấy từ mốc quý · 1–2 dự án trọng tâm · nơi DUY NHẤT sửa kế hoạch năm
          └─ THÁNG  3 O · KR số (KR CV/TC có 4 phần §8.4) · KA tuỳ chọn
              └─ TUẦN   1 O → 3 KR → KA · O tuần ghi "đóng góp vào KR tháng" + chỉ tiêu tuần
                  └─ NGÀY   1 O → 3 KR → KA · O ngày chọn phục vụ 1 KR hoặc 1 KA tuần
```

### 3.1 Kiểu liên kết

| Liên kết | Cách làm | Bắt buộc? |
|---|---|---|
| **Ngày → Tuần** | O ngày chọn **"phục vụ"** 1 KR hoặc 1 KA của tuần (chọn từ danh sách). Gắn vào KA thì KA tuần **tự tick** khi % O ngày đạt ngưỡng đạt (mặc định 80%), sửa tay được. | Khuyến nghị. Hiện **Mức tập trung x/7**, không cảnh báo đỏ. |
| **Tuần → Tháng** | O tuần ghi: **đóng góp vào KR tháng nào** + **chỉ tiêu tuần** (gợi ý sẵn từ kế hoạch cộng dồn/nhịp độ). Kaizen tuần ghi **thực tế tuần**, cộng vào KR tháng nếu bật liên kết. | Khuyến nghị. |
| **Lịch lặp lại → KR tháng** | Mục lặp lại (VD "Chạy bộ 5km") gắn 1 KR tháng (thường MQH/TTT). Mỗi lần Check ở Ngày cộng giá trị (mặc định +1) vào thực tế KR. | Tuỳ chọn. |
| **Tháng → Quý → Năm → Tầm nhìn** | KR tháng là phân kỳ của KR quý, KR quý là mốc của KR năm (`parent_kr_id`). % tính từ số thực tế, **không lấy trung bình từ cấp dưới**. | Khi lập Tháng, KR CV/TC nên có cha là KR quý. |

- **Tuần thuộc tháng** theo ngày thứ Năm của tuần (chuẩn ISO). **[Giả định]**
- Không có quy tắc 60%, không có cờ "KR liên quan O" ở Ngày.

---

## 4. Tiêu chí kiểm tra

### 4.1 Tiêu điểm O (mọi cấp): 6 tiêu chí + nút "Kiểm tra tiêu điểm"

| Ô | Câu hỏi | Kiểm tự động |
|---|---|---|
| S | Tất cả đều hiểu? | Không |
| M | Đo lường được? | Tick M bắt buộc có **số đo O** (ô riêng). Thiếu thì cảnh báo, không cho tick khi bấm "Kiểm tra". |
| A | Khả thi? | Ngày: nhắc nếu lịch cố định đã kín > 80% khung giờ. **[Giả định]** |
| R | Quan trọng nhất? | Nhãn gợi ý: "Quan trọng nhất trong các việc làm được kỳ này để đạt O cấp trên". |
| T | Thời gian rõ ràng? | Ngày/Tuần: mặc định hết kỳ. Tháng+: lấy theo hạn KR. |
| KR→O | Các KR đạt thì O có đạt không? | Chỉ tick được khi đã có đủ số KR tối thiểu. |

Nút **"Kiểm tra tiêu điểm"** mở lần lượt 6 câu, mỗi câu có giải thích ngắn và 1 ví dụ đúng/sai. Tick xong thì đóng.

### 4.2 KR Ngày/Tuần
- 5 ô S-M-A-R-T cho từng KR. Tick M thì phải có số đo.
- Câu kiểm cuối khối: *"Hoàn thành các KA này thì KR có đạt không? Còn làm gì nữa để KR đạt trọn vẹn?"* kèm nút **+ Thêm KA**.
- Gợi ý (không chặn): KR bắt đầu bằng động từ hành động → nhắc viết lại thành kết quả.

### 4.3 KR Tháng/Quý/Năm (mẫu số)

```
Từ [hiện tại] → [đích] trước [ngày] · Nguồn đo: [nguồn]
```

Thiếu bất kỳ trường nào thì **không cho chốt**. 3 câu kiểm:
1. Có con số (bắt đầu và đích) không?
2. Có hạn và nguồn đo không?
3. Nếu tất cả KR của O đạt thì O có đạt không?

### 4.4 Tầm nhìn
Mỗi mục tiêu năm phải có **Điều kiện kiểm tra** (kiểm chứng được). Chưa điền thì hiện **"chưa hợp lệ"**. App không tự đặt con số.

### 4.5 Chốt kế hoạch

| Cấp | Điều kiện bật nút Chốt |
|---|---|
| Ngày, Tuần | O đủ 6 tiêu chí · ≥ 3 KR (tối đa 4) · mỗi KR đủ 5 SMART |
| Tháng, Quý, Năm | Đủ 3 O · O CV/TC ≥ 3 KR, O MQH và O TTT mỗi O ≥ 1 KR · mọi KR đủ Từ–Đến–Hạn–Nguồn · cảnh báo công suất (§9) đã có KR đội ngũ |

Chưa đủ vẫn chốt được nếu **ghi lý do**.

**Kỷ luật (cài đặt, mặc định bật):**
- Kế hoạch ngày D tự khoá lúc 22:00 ngày D-1. Sửa sau giờ khoá phải ghi lý do.
- Đỏ 2 ngày làm việc liền (% O ngày < ngưỡng đỏ hoặc không lập O) mà chưa viết Bài học → không thêm KR/KA mới cho đến khi viết.

---

## 5. OKR Ngày (7 bước)

Dạng wizard: bước sau mở khi bước trước có nội dung tối thiểu.

**Dải cấp trên** (hiện trước bước 5): % O tuần · % 3 O tháng (O CV/TC nổi bật, kèm Tình trạng) · % O năm.

| Bước | Tên | Nội dung |
|---|---|---|
| 1 | **1a. Lịch cố định & cam kết** | Bảng giờ 04:30–22:30, 2 cột (Sáng / Chiều–Tối). Mỗi ô giờ chứa **nhiều mục**: nội dung · loại (Việc / Lời hứa / Lịch hẹn) · với ai · Check. Thuộc tính **Cố định** (tô vàng). Thuộc tính **Lặp lại**: hằng ngày / các thứ trong tuần / ngày X hằng tháng; ngày bắt đầu và kết thúc; sửa 1 lần hay cả chuỗi. Gắn KR tháng (tuỳ chọn). Có thêm danh sách **"Lời hứa chưa có giờ"**. Sự kiện & mốc từ Tháng/Quý/Năm rơi vào ngày này tự hiện (nhãn nguồn). Cách dùng 2 thuộc tính: xem §5.1. |
| 2 | **1b. Quan sát** | 3 cột: CV/TC · MQH · TTT. Mỗi ý có ô **"Nếu không làm thì sao?"**, bỏ trống thì cảnh báo. **Mang sang:** ý chưa đóng của hôm qua/tuần này hiện sẵn, nhãn "từ hôm qua"; người dùng giữ, sửa hoặc đóng. |
| 3 | **2. Phân tích** | Nhóm theo 3 mảng. Tô đậm việc đủ nhân duyên giải quyết trong ngày. |
| 4 | **3. Nguyên nhân lõi** | Với từng việc tô đậm: Tham · Sân · Si + câu kiểm *"Giải quyết nguyên nhân này thì vấn đề có hết không?"*. Nhắc quy tắc dừng: tới nguyên nhân đổi được bằng 1 hành động cụ thể. |
| 5 | **Tiêu điểm O** | 1 câu · số đo O · 6 tiêu chí + nút Kiểm tra · chọn **phục vụ KR/KA tuần**. Hiện lại nguyên nhân ở bước 4 để O xử lý gốc, không xử lý triệu chứng. |
| 6 | **KR1–KR3** | Mặc định 3 KR, tối đa 4 (cài đặt). Mỗi KR: SMART, số đo. |
| 7 | **KA dưới từng KR** | Mỗi KR là một khối riêng có danh sách KA của nó, thụt lề rõ. Tick hoàn thành. |

### 5.1 Cố định và Lặp lại (2 công tắc độc lập)

| | Không lặp | Lặp lại |
|---|---|---|
| **Không cố định** | Việc thường, dời được | Thói quen dời giờ được (VD đọc sách 20 phút) |
| **Cố định (tô vàng)** | Lịch hẹn 1 lần không dời (VD hẹn khách 14:00 thứ Năm 13/11) | Lịch cứng hằng tuần (VD gọi Phonetem 09:30 T2–T6) |

- Lặp lại: hằng ngày / các thứ trong tuần / ngày X hằng tháng, có ngày kết thúc. Sửa: hỏi "chỉ lần này" hay "cả chuỗi".
- Gắn KR tháng: VD "Chạy bộ 5km 16:30, hằng ngày" gắn KR TTT "Chạy 20 buổi/tháng"; mỗi Check ở Ngày cộng +1 vào thực tế KR.

---

## 6. Kaizen Ngày (4 bước)

| Bước | Tên | Nội dung |
|---|---|---|
| 1 | **Đo lường** | **% thực thi** lấy tự động từ KR/KA. **O đạt thực tế:** nhập số đo O thực tế (nếu O có số), hoặc chọn Đạt / Một phần / Chưa đạt (= 100 / 50 / 0). Lệch ≥ 30 điểm giữa 2 số → gợi ý từ khoá "KR chọn chưa trúng O" ở bước 2b. **[Giả định: 30 điểm]** Ô đánh giá ngắn. |
| 2a | **Nhật ký** | Bảng dòng **Giờ \| Đã làm gì \| Kết quả**, không chia buổi. Tự điền sẵn dòng từ lịch giờ và KA đã tick, người dùng ghi Kết quả và thêm dòng. Chỉ ghi sự thật, có giờ và số liệu. |
| 2b | **Nguyên nhân % tiêu điểm** | Nguyên nhân của cả thành công lẫn thất bại, tới tận cùng, dừng ở nguyên nhân đổi được bằng 1 hành động. Bôi đỏ từ khoá. |
| 3 | **Bài học** | Mỗi bài học gắn 1 từ khoá đỏ, có ô "Dấu hiệu nhận biết". |
| 4 | **Hành động tiếp theo** | SMART + tiêu chí 6 "Đưa được vào OKR kỳ tới". Nút **Chuyển thành KR/KA ngày mai** (bản nháp). Khuyến nghị tối đa 3/ngày. |

Cuối bản, chữ đỏ: *Bản Kaizen đã cụ thể chưa? Bạn hài lòng chưa? Chưa thì chỗ nào? Ai có thể giúp? Liên hệ tham vấn ngay.* Kèm ô ghi tên người.

**% dùng cho màu và chuỗi đỏ:** dùng % O thực tế nếu đã nhập, chưa nhập thì dùng % thực thi.

---

## 7. OKR Tuần + Kaizen Tuần

**OKR Tuần** dùng cùng 7 bước như Ngày, khác ở các điểm sau:
- **Dải cấp trên + chart** (trước bước 5):
  - % 3 O tháng và % O năm.
  - Chart cột: % các tuần trong tháng.
  - Chart đường: kế hoạch cộng dồn so với thực tế của KR CV/TC tháng.
- **1a:** lưới T2 → CN × Sáng/Chiều/Tối. Tự hiện mục cố định và mục lặp lại của các ngày.
- **O tuần:** 6 tiêu chí + **đóng góp vào KR tháng nào + chỉ tiêu tuần** (gợi ý sẵn).
- **3 KR → KA** riêng của tuần. KR/KA tuần là thứ O ngày chọn để phục vụ.
- **Kiểm chứng 3 chiều** (§12).
- **Mức tập trung x/7**: hiện như thông tin.

**Kaizen Tuần** dùng cùng 4 bước như Ngày, khác ở các điểm sau:
- Đo lường: % thực thi tuần (trung bình KR tuần) + O tuần thực tế + **thực tế đóng góp KR tháng** (số).
- Nhật ký: dòng **Ngày \| Đã làm gì \| Kết quả**, tự điền từ O và % từng ngày.
- Nguyên nhân: gợi ý sẵn **từ khoá đỏ lặp lại nhiều nhất** trong tuần và bài học trùng. Người dùng chỉnh lại, không nhập từ đầu.
- Hành động chuyển vào KR/KA tuần sau.
- Nếu luật kích hoạt (§11.3) đang bật cho KR tháng: bắt buộc chọn quyết định ngay trong Kaizen tuần.

**Chu kỳ:** Chủ nhật hoặc thứ Hai.

---

## 8. OKR Tháng, Quý, Năm, Tầm nhìn

### 8.1 Quy trình chung (Tháng, Quý, Năm)
1. **Quan sát** 3 mảng, mỗi ý có "Nếu không làm thì sao?". Mang sang từ kỳ trước.
2. **Phân tích**: tô đậm.
3. **Nguyên nhân lõi**: Tham–Sân–Si.
4. **3 O** theo 3 mảng, mỗi O có 6 tiêu chí.
5. **KR số** (§4.3): CV/TC ≥ 3, MQH và TTT mỗi O 1–2. KA tuỳ chọn.
6. **Kiểm chứng** (Tháng, Quý) bằng bảng số liệu.
7. **Sự kiện & mốc quan trọng** (tuỳ chọn): danh sách {ngày, giờ (nếu có), tên, với ai, loại: lịch hẹn / deadline / sự kiện / lời hứa, gắn O}. Tự hiện xuống lưới Tuần và bảng giờ Ngày khi đến tuần/ngày đó.

Không có lưới giờ, không có nhật ký. Kaizen dùng **Kaizen số liệu** (§11).

### 8.2 Tầm nhìn (rà 1 lần/năm)
- Bảng gồm: Năm thứ · Mục tiêu · **Điều kiện kiểm tra** (bắt buộc) · trạng thái hợp lệ.
- Người dùng chọn **ngày bắt đầu Năm 1**.
- **Kỳ khởi động:** nếu bắt đầu giữa năm (VD 04/11/2026), phần còn lại của năm là kỳ khởi động dùng cấu trúc Quý (3 O, KR số, dự án trọng tâm). Chu kỳ năm chuẩn bắt đầu từ cửa sổ 1–5/1 năm sau.

| Năm | Mục tiêu (ví dụ người dùng nhập) | Điều kiện kiểm tra |
|---|---|---|
| 1 | Thu nhập bằng lương + hệ thống chạy ổn định | Hệ thống tạo ≥ [X]/tháng liên tục [3] tháng; tôi ≤ [Y] giờ/tuần |
| 2 | Thu nhập thụ động 200.000 USD/năm | Nghỉ 90 ngày, thu nhập giữ ≥ [Z]% |
| 3 | 500.000 USD/năm | Nhân bản bằng [đòn bẩy]: số người, thu nhập/người, tỷ lệ giữ chân |

### 8.3 Năm
- 3 O gắn mục tiêu Năm trong Tầm nhìn.
- Mỗi KR chia ngược thành **4 mốc quý** (số).
- KR thu nhập phải kèm **Mô hình thu nhập** (§9).
- O có nhãn **"thụ động"** → bắt buộc ≥ 1 KR về **đội ngũ tự vận hành** (VD % thu nhập đến từ người mình không trực tiếp làm cùng).

### 8.4 Quý (cấp điều chỉnh)
- 3 O; KR lấy từ mốc quý của năm.
- Chọn **1–2 dự án trọng tâm**, còn lại là việc nền.
- **Nơi duy nhất được sửa kế hoạch năm.** Mỗi lần sửa tạo phiên bản mới, giữ bản gốc, kèm lý do bằng số liệu (§11.4).

### 8.5 Tháng (mắt xích chống trì hoãn)
KR của O CV/TC có đủ 4 phần:

| Phần | Nội dung |
|---|---|
| Chỉ số kết quả | Lagging, VD: 10 người hoạt động mới |
| Chỉ số dẫn trước | Leading, VD: 40 cuộc gọi/tuần, 8 hẹn/tuần |
| Nhịp độ chia ngược | Tự tính từ Mô hình thu nhập (§9); "ước lượng" nếu có hệ số chưa đo |
| Kế hoạch cộng dồn | Mốc theo tuần, VD: T1 = 2, T2 = 5, T3 = 8, T4 = 10. Mặc định chia đều, sửa được |

KR của O MQH/TTT: dạng Từ–Đến–Hạn–Nguồn. Nguồn có thể là **"đếm từ lịch lặp lại X"**.

Kế hoạch tháng chỉ sửa trong Kaizen tháng. Muốn sửa kế hoạch năm thì làm ở Quý.

---

## 9. Mô hình thu nhập (phễu tự cấu hình)

### 9.1 Đầu vào (đổi được theo thời gian, mỗi hệ số có cờ "chưa đo")

| Trường | Ý nghĩa |
|---|---|
| `name` | Tên nguồn thu (mỗi nguồn 1 mô hình) |
| `target_income_month` | Thu nhập mục tiêu/tháng. Nhập theo năm thì chia 12 |
| `currency`, `fx_rate`, `fx_updated_at` | Tỷ giá nhập tay, hiện rõ ngày cập nhật |
| `value_per_unit` | Thu nhập mỗi đơn vị kết quả tạo ra/tháng (VD 500 USD/người hoạt động, hoặc hoa hồng/đơn) |
| `retention` | Tỷ lệ giữ chân theo quý (tuỳ chọn, bỏ trống = 100%) |
| `stages` | Danh sách bước từ trên xuống, mỗi bước có `name` + `conversion_to_next` |
| `working_days_week` | Số ngày làm việc/tuần |
| `capacity_per_day` | Công suất tối đa ở bước đầu/ngày |

### 9.2 Phép tính

```
units_needed     = target_income_month / value_per_unit
units_to_acquire = units_needed / retention
Đi ngược qua từng bước: need[i] = need[i+1] / conversion_to_next[i]
top_per_week     = need[0] × 12 / 52
top_per_day      = top_per_week / working_days_week
```

Kết quả đưa vào 3 chỗ:
- Nhịp độ chia ngược ở KR tháng.
- Chỉ tiêu tuần ở O tuần.
- Gợi ý số hành động/ngày ở Ngày.

### 9.3 Quy tắc
- Hệ số chưa đo → nhịp độ hiện "ước lượng". Trong 2 tháng đầu, app tự gợi ý KR **"đo hệ số X"**.
- `top_per_day > capacity_per_day` → **cảnh báo đỏ**: "Tăng nỗ lực cá nhân không đủ, cần KR đội ngũ tự vận hành hoặc đòn bẩy". Phải có KR đó mới chốt được.
- Mục tiêu năm sau gấp nhiều lần năm trước → hiện **hệ số nhân bản cần có**.

### 9.4 Ví dụ (số minh hoạ, không phải dự báo)

| Nguồn | Các bước |
|---|---|
| Hệ thống tuyển dụng | Cuộc gọi → (20%) Hẹn → (25%) Vào hệ thống → giữ chân 60% → Người hoạt động × 500 USD |
| Affiliate quảng cáo | Click → (3%) Đơn → Hoa hồng/đơn. Bước đầu đo bằng click/ngày; công suất = ngân sách/ngày ÷ CPC |

---

## 10. Công thức tính

### 10.1 Ngày, Tuần (tick)

| Chỉ số | Công thức |
|---|---|
| % KR | KA đã tick / tổng KA. Chỉnh tay được, bắt buộc ghi lý do |
| % thực thi O | Trung bình % các KR (trọng số tuỳ chọn) |
| % O thực tế | Từ Kaizen bước 1 |
| % tuần | Trung bình % các KR tuần. KA tuần có thể tự tick từ O ngày (§3.1) |

### 10.2 Tháng, Quý, Năm (số)

| Chỉ số | Công thức |
|---|---|
| % KR số | (thực tế − bắt đầu) / (đích − bắt đầu), chặn trong khoảng 0–100 |
| Kế hoạch cộng dồn đến hôm nay | Mốc tuần đã qua + nội suy tuyến tính trong tuần hiện tại **[Giả định]** |
| Tình trạng | thực tế cộng dồn / kế hoạch cộng dồn đến hôm nay |
| % O | Trung bình % KR của O (trọng số tuỳ chọn) |

- Không lấy trung bình từ % Ngày/Tuần.
- Thực tế được nhập tay, hoặc cộng tự động từ thực tế tuần / Check của lịch lặp lại nếu bật liên kết.
- **Luôn hiện bảng từng KR**, để trung bình không che mất KR đang 0%.

### 10.3 Màu

| Đo cái gì | Đỏ | Vàng | Xanh |
|---|---|---|---|
| % hoàn thành Ngày/Tuần | < 50 | 50–79 | ≥ 80 (ngưỡng đạt) |
| Tình trạng Tháng/Quý/Năm | < 70 | 70–89 | ≥ 90 |

---

## 11. Kaizen số liệu (Tháng, Quý, Năm)

### 11.1 Năm bước
1. **Số liệu:** bảng từng KR gồm kế hoạch cộng dồn · thực tế · chênh lệch · màu. Lấy tự động.
2. **Chẩn đoán:** mỗi KR vàng/đỏ chọn 1 trong 4 nhóm nguyên nhân (§11.2), kèm số liệu chứng minh.
3. **Quyết định:** mỗi KR chọn đúng 1: Giữ · Tăng nỗ lực · Cắt phạm vi · Đổi cách làm · Dừng.
4. **Bài học:** tối đa 3 câu, mỗi câu kèm 1 con số.
5. **Điều chỉnh:** Tháng sửa kế hoạch tháng. Quý sửa kế hoạch năm (tạo phiên bản). Năm rà Tầm nhìn.

### 11.2 Bốn nhóm nguyên nhân
| Nhóm | Nghĩa | Dấu hiệu bằng số |
|---|---|---|
| (a) Đầu vào thiếu | Làm chưa đủ | Chỉ số dẫn trước < nhịp độ |
| (b) Chuyển đổi thấp | Làm đủ mà ít kết quả | Dẫn trước đạt, tỷ lệ chuyển đổi < hệ số mô hình |
| (c) Giữ chân kém | Có vào nhưng rời đi | Giữ chân thực tế < hệ số |
| (d) Bên ngoài | Ngoài tầm kiểm soát | Sự kiện cụ thể + ngày |

### 11.3 Luật kích hoạt (mặc định bật)
- KR tháng trễ > 20% hai tuần liên tiếp → bắt buộc chọn quyết định ngay trong Kaizen tuần đó.
- KR quý trễ > 30% → mở chẩn đoán đầy đủ.
- Mỗi lần kích hoạt ghi vào nhật ký kích hoạt, hiện ở Dashboard.

### 11.4 Chống hạ mục tiêu để trốn việc
- Chỉ được **hạ** KR khi nguyên nhân thuộc nhóm (b), (c) hoặc (d), kèm số liệu.
- Nhóm (a) không được hạ, chỉ được chọn "Tăng nỗ lực".
- Mọi lần hạ ghi vào lịch sử phiên bản. Dashboard hiện "đã hạ X lần".

### 11.5 Luật điều chỉnh kế hoạch (mọi cấp có KR số; Ngày/Tuần dùng khoá kế hoạch §4.5)

| Loại thay đổi | Khi nào | Điều kiện | Giới hạn mặc định |
|---|---|---|---|
| **Thêm KR / O** | Bất cứ lúc nào | Không vượt trần số KR (§15). Đủ trần thì phải Tạm dừng hoặc Dừng 1 KR khác | Theo trần |
| **Nâng đích · Đổi cách làm** | Bất cứ lúc nào | Ghi lý do | Không giới hạn |
| **Hạ đích · Cắt phạm vi** | Chỉ ở buổi rà (Tháng/Quý) | Nguyên nhân nhóm (b)/(c)/(d) + số liệu. Nhóm (a) chỉ được chọn "Tăng nỗ lực" | 1 lần / KR / quý |
| **Dừng KR / O** | Chỉ ở buổi rà | Lý do + chọn KR thay thế hoặc ghi "không thay" | 1 lần / quý |
| **Sửa ngoài buổi rà** | Bất cứ lúc nào | Thành **"đề xuất điều chỉnh"**, áp dụng sau 48 giờ. Nhóm (d) (sự kiện bên ngoài) áp dụng ngay | — |
| **Vượt giới hạn** | — | Vẫn sửa được nhưng bắt buộc ghi tên mentor đã duyệt (kiểm chứng dưới lên) | Dashboard hiện "vượt giới hạn x lần" |

- Mọi thay đổi tạo **phiên bản mới**, luôn so với bản gốc (Dashboard và trang kỳ hiện "bản gốc → hiện tại").
- Kế hoạch năm chỉ sửa ở Quý (hoặc kỳ khởi động); kế hoạch tháng sửa ở Kaizen tháng hoặc qua đề xuất điều chỉnh.

---

## 12. Kiểm chứng 3 chiều (Tuần, Tháng, Quý)

| Khối | Đối tượng |
|---|---|
| Trên xuống | Người chịu ảnh hưởng bởi mục tiêu |
| Chéo | Phòng ban / người khác bị ảnh hưởng |
| Dưới lên | Sếp, Thầy, Mentor (xin duyệt hướng đi) |

- Mỗi dòng: tên · đã hỏi ý kiến (tick) · 5 ô SMART · ghi chú.
- Tháng/Quý: kiểm chứng bằng bảng số liệu (đính kèm bản xuất).
- Ngày: không có kiểm chứng.

---

## 13. Nhịp rà và nhắc giờ

| Kỳ | Khi nào | Thời lượng | Nội dung |
|---|---|---|---|
| Ngày | 20:00 hằng ngày | ≤ 30 phút | Kaizen hôm nay + OKR ngày mai |
| Tuần | Chủ nhật hoặc thứ Hai | 30 phút | Kaizen tuần + OKR tuần mới, đối chiếu cộng dồn tháng |
| Tháng | Ngày cuối tháng hoặc ngày đầu tháng | 60 phút | Kaizen số liệu + OKR tháng |
| Quý | Ngày cuối của tháng cuối quý hoặc ngày đầu của tháng đầu quý | 2–3 giờ | Rà KR, chỉnh hướng, dự án trọng tâm |
| Năm | 1–5/1 | Nửa ngày | Rà Tầm nhìn, OKR năm |

- Buổi rà Tháng/Quý là lịch cố định. Bỏ qua phải ghi lý do.
- Lập kỳ ngoài cửa sổ rà vẫn được, app ghi "lập muộn x ngày".
- Lần đầu dùng: kỳ khởi động 11–12/2026 (§8.2).
- Lập OKR ngày mai khi chưa có Kaizen hôm nay → cảnh báo nhẹ.
- Nhắc giờ bằng banner trong app + file lịch .ics cho từng kỳ (web app tĩnh không gửi được thông báo khi đang tắt).

---

## 14. Màn hình

1. **Dashboard:** thanh Tình trạng Năm/Quý/Tháng (cộng dồn so với thực tế) · bảng từng KR · % Ngày/Tuần · Mức tập trung · cảnh báo (luật kích hoạt, công suất, hệ số chưa đo, số lần hạ mục tiêu, buổi rà bị bỏ).
2. **Tầm nhìn**
3. **Năm** / **Quý**: 3 O, KR số, mốc quý, dự án trọng tâm, lịch sử phiên bản.
4. **Tháng**: 3 O, KR số, bảng cộng dồn, kiểm chứng, Kaizen số liệu.
5. **Mô hình thu nhập**
6. **Tuần** (§7)
7. **Ngày** (§5, §6)
8. **Cây liên kết:** Tầm nhìn → … → KA, màu theo tình trạng.
9. **Lịch sử Kaizen:** tìm theo từ khoá đỏ, nhóm nguyên nhân, quyết định.
10. **Cài đặt**

Mỗi cấp có **2 tab OKR | Kaizen**, chuyển bằng 1 chạm, không chia đôi màn hình.
- Tab Kaizen có phần đầu **tóm tắt OKR chỉ đọc** (O, KR, %, KA đã tick).
- Tab mở sẵn: trước giờ nhắc → OKR; sau giờ nhắc → Kaizen; lập kế hoạch kỳ tới → OKR. Tháng/Quý/Năm: trong cửa sổ rà → Kaizen, ngoài cửa sổ → OKR.

Ô tiêu đề vàng nhạt, ô điền trắng, mục cố định vàng đậm, dải **TIÊU ĐIỂM + % HOÀN THÀNH**, câu hỏi gợi ý hiện dạng placeholder/tooltip. Responsive cho điện thoại, lưu tự động, xuất PDF/Excel từng kỳ.

---

## 15. Cài đặt

| Cài đặt | Mặc định |
|---|---|
| Số KR Ngày/Tuần (tối thiểu / tối đa) | 3 / 4 |
| Số KR Tháng+ (CV/TC tối thiểu; MQH, TTT tối thiểu / tối đa) | 3; 1 / 2 |
| Ngưỡng màu % Ngày/Tuần (đỏ / đạt) | 50 / 80 |
| Ngưỡng màu Tình trạng Tháng+ (đỏ / xanh) | 70 / 90 |
| KA tuần tự tick khi O ngày đạt | Bật, theo ngưỡng đạt |
| Lệch % thực thi và % O thực tế để gợi ý | 30 điểm |
| Luật kích hoạt | trễ > 20% × 2 tuần; KR quý trễ > 30% |
| Trọng số KR/KA | Tắt |
| Tự khoá kế hoạch ngày | Bật, 22:00 hôm trước |
| Khoá thêm việc khi đỏ liền | Bật, 2 ngày |
| Ngày nghỉ trong tuần | Không |
| Giờ nhắc Ngày | 20:00 |
| Khung giờ Ngày, độ dài ô | 04:30–22:30, 30 phút |
| Tối đa hành động Kaizen/ngày (khuyến nghị) | 3 |
| Tỷ giá | Nhập tay |
| Trần số KR đang mở (Tháng/Quý/Năm, mỗi cấp) | 7 |
| Hạ đích tối đa | 1 lần / KR / quý |
| Dừng KR/O tối đa | 1 lần / quý |
| Thời gian chờ đề xuất điều chỉnh | 48 giờ |
| Tab mở sẵn | Theo giờ nhắc |

---

## 16. Dữ liệu (thay đổi so với app hiện tại)

| Thành phần | Thay đổi |
|---|---|
| `periods` | Thêm `kind = 'quarter'`. Bỏ O nằm sẵn trong kỳ, chuyển sang bảng `objectives`. |
| `objectives` (mới) | `period_id, area (cv_tc / mqh / ttt / null cho Ngày/Tuần), title, smart, o_metric, o_actual, o_result (dat / mot_phan / chua), serves_kr_id?, serves_ka_id?, contributes_kr_id?, weekly_target?, weekly_actual?, passive (bool)` |
| `key_results` | Thêm `kind (tick / numeric)`, `objective_id`, `parent_kr_id`, `baseline, target, deadline, source`, `leading (jsonb)`, `cumulative_plan (jsonb)`, `income_model_id`. Bỏ `linked`, `link_reason`. |
| `kr_actuals` (mới) | `kr_id, date, value, source (manual / week / recurring)` |
| `schedule_items` | Thêm `kind (viec / loi_hua / lich_hen)`, `series_id`, `untimed`. Bỏ ràng buộc mỗi ô 1 mục. |
| `schedule_series` (mới) | Mẫu lặp lại: `rule (daily / weekly / monthly), weekdays[], month_day, start, end, time_from, time_to, title, fixed, kr_id, increment` |
| `kaizen` | Ngày/Tuần: `journal` thành danh sách dòng `{time, did, result}`. Thêm bảng `kaizen_long` (snapshot, diagnoses, decisions, lessons) và `plan_versions`, `trigger_log` |
| `income_models` (mới) | Theo §9.1, `stages jsonb`, `unknown jsonb` |
| `vision_items` (mới) | `year_no, start_date, goal, verification` |
| `visions`, `goals`, `metrics` | **Bỏ** (C12). Nếu đã có dữ liệu thì xuất JSON trước khi xoá. |
| `events` (mới) | Sự kiện & mốc Tháng/Quý/Năm: `period_id, date, time?, title, people, kind, objective_id?` |
| `plan_changes` (mới) | `kr_id/objective_id, type (add / raise / method / lower / cut / stop), reason, cause_group?, evidence, mentor?, status (pending / applied), apply_at, version_id` |
| `settings` | Thêm các mục §15 |

Mọi bảng bật RLS và cấp quyền `authenticated`.

---

## 17. Kỹ thuật

- React + Vite + TypeScript, Supabase (đăng nhập, RLS), GitHub Pages.
- Logic tính tách riêng ở `src/lib/`, **có unit test** cho:
  - % tick và % số
  - % O thực tế và độ lệch
  - Phễu chia ngược
  - Kế hoạch cộng dồn và Tình trạng
  - Luật kích hoạt
  - Chống hạ mục tiêu
  - Sinh lịch lặp lại
  - Tự tick KA tuần
  - Chặn Chốt
  - Chuỗi đỏ
- Chart: thư viện nhẹ tải từ CDN hoặc SVG tự vẽ.

### Thứ tự xây (đi từ trên xuống, nhưng giao giá trị dùng hằng ngày sớm)
1. Logic mới + test (mục §17 ở trên).
2. **Ngày theo v3:** lịch nhiều mục + lặp lại, dải cấp trên, bỏ cờ KR liên quan, Phân tích/Nguyên nhân nhóm 3 mảng, nhật ký dạng dòng, % O thực tế, mang sang, nút Kiểm tra tiêu điểm.
3. **Tuần:** OKR 7 bước, 3 KR/KA, liên kết Ngày → Tuần, Kiểm chứng, Kaizen tuần tổng hợp.
4. **Tầm nhìn + Năm + Quý (bản lập kế hoạch) + Mô hình thu nhập.**
5. **Tháng:** 3 O, KR số, cộng dồn, liên kết Tuần → Tháng, lịch lặp lại → KR.
6. **Kaizen số liệu**, phiên bản, luật kích hoạt, chống hạ mục tiêu.
7. Dashboard, cây liên kết, lịch sử Kaizen, xuất PDF/Excel.

Mỗi giai đoạn dừng cho Luca dùng thử.

---

## 18. Dữ liệu mẫu
- Ngày 02/12/2024 (giữ nguyên spec v2 §18.1). O 73% = KR 100 / 70 (chỉnh tay, có lý do) / 50.
- Mô hình thu nhập minh hoạ ở §9.4.
- KR tháng mẫu: "Số người hoạt động mới: 0 → 10 trước 31/12, nguồn: bảng theo dõi. Dẫn trước 40 gọi/tuần, 8 hẹn/tuần. Cộng dồn T1 = 2, T2 = 5, T3 = 8, T4 = 10."

---

## 19. Câu hỏi còn mở (đã có giả định, đổi được khi duyệt)

| # | Câu hỏi | Giả định |
|---|---|---|
| Q1 | Gắn O ngày vào KR/KA tuần có cần ghi lý do không? | Không bắt buộc (đã bỏ quy tắc 60%) |
| Q2 | KA tuần tự tick khi O ngày đạt bao nhiêu? | Theo ngưỡng đạt 80% |
| Q3 | O ngày "thực tế" đo bằng số hay 3 mức? | Có số đo O thì nhập số; không có thì chọn 3 mức |
| Q4 | Lệch bao nhiêu thì gợi ý "KR chọn chưa trúng O"? | 30 điểm |
| Q5 | Lặp lại "ngày 31 hằng tháng" khi tháng chỉ có 30 ngày? | Rơi vào ngày cuối tháng |
| Q6 | Kế hoạch cộng dồn trong tuần | Nội suy tuyến tính |
| Q7 | Tuần cắt ngang 2 tháng thuộc tháng nào? | Theo ngày thứ Năm của tuần |
| Q8 | Dữ liệu ở màn Mục tiêu ưu tiên hiện tại | Xuất JSON rồi chuyển tay sang Tầm nhìn/Năm |
| Q9 | Trần số KR đang mở mỗi cấp Tháng+ | 7 (3 CV/TC + 2 + 2) |
| Q10 | Đề xuất điều chỉnh có huỷ được trong 48 giờ không? | Có, huỷ không tính vào giới hạn |
