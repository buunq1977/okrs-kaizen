# SPEC v2: Ứng dụng quản lý OKR + Kaizen (Tầm nhìn – Năm – Quý – Tháng – Tuần – Ngày)

> Dùng để giao cho Claude xây ứng dụng.
> **Ngày và Tuần giữ nguyên thiết kế cũ** (đã dùng tốt). **Từ Tháng trở lên** đổi sang kết quả đo bằng số, có mô hình thu nhập, kế hoạch cộng dồn và Kaizen bằng số liệu.
> Mọi ngưỡng ở §14 là **cài đặt**, không hard-code.

---

## 1. Mục đích

Ứng dụng giúp một người đi từ **tầm nhìn dài hạn** xuống **việc làm hôm nay**, và đo ngược từ hôm nay lên tầm nhìn. Gồm hai vòng lặp:

- **Vòng ngắn (Ngày, Tuần):** OKR hoạt động + Kaizen nhật ký/nguyên nhân (kỷ luật hằng ngày).
- **Vòng dài (Tháng, Quý, Năm, Tầm nhìn):** OKR bằng số + Kaizen bằng số liệu (kiểm soát tiến độ, chống trì hoãn).

Ứng dụng phải **ép đúng quy trình**, không chỉ là sổ ghi chú. Ngôn ngữ giao diện: **tiếng Việt**.

---

## 2. Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| **O (Objective) / Tiêu điểm** | Mục tiêu chính của một kỳ. |
| **KR (Key Result)** | Kết quả then chốt. Ở Ngày/Tuần: hạng mục để hoàn thành O. Ở Tháng trở lên: **con số** có điểm bắt đầu, đích, hạn. |
| **KA (Key Action)** | Hành động cụ thể, có ô tick. |
| **SMART** | S: tất cả đều hiểu · M: đo lường được · A: khả thi · R: quan trọng nhất · T: thời gian rõ ràng. |
| **Chỉ số kết quả (lagging)** | Cái muốn đạt cuối cùng (số người hoạt động, thu nhập). |
| **Chỉ số dẫn trước (leading)** | Cái làm được hằng ngày/tuần dẫn tới kết quả (số cuộc gọi, số hẹn). |
| **Nhịp độ chia ngược** | Từ mục tiêu năm/quý/tháng tính ra việc phải chạy mỗi tuần/ngày. |
| **Kế hoạch cộng dồn** | Số lẽ ra phải đạt tính đến hôm nay, so với số thực tế. |
| **Phiên bản kế hoạch** | Bản gốc và các bản điều chỉnh, luôn so với bản gốc. |

---

## 3. Chuỗi liên kết các cấp

```
TẦM NHÌN (3–10 năm)    trạng thái muốn đạt + điều kiện kiểm tra
  └─ NĂM      1–3 O · mỗi O 3–4 KR (số) · chia 4 mốc quý
      └─ QUÝ  1–3 O · KR (số) lấy từ mốc quý · 1–2 dự án trọng tâm · chỗ DUY NHẤT được chỉnh hướng
          └─ THÁNG  KR = chỉ số kết quả + dẫn trước + nhịp độ + kế hoạch cộng dồn
              └─ TUẦN   O tuần có chỉ tiêu "đóng góp vào KR tháng"        (giữ nguyên cấu trúc)
                  └─ NGÀY   O ngày → 3 KR → nhiều KA                       (giữ nguyên cấu trúc)
```

### 3.1 Hai kiểu liên kết, khác nhau

| Liên kết | Kiểu | Quy tắc |
|---|---|---|
| **Ngày → Tuần** | "Là KR của" | O ngày là KR tuần. Ít nhất **60%** O ngày liên quan O tuần (7 ngày → ≥ 5). Phần ≤ 40% là việc nền. *(giữ nguyên)* |
| **Ngày** | Trong ngày | Ít nhất **1 KR** (trong 3 KR) liên quan trực tiếp O ngày; cảnh báo nếu chỉ 1, gợi ý ≥ 2. |
| **Tuần → Tháng** | "Đóng góp vào" | Mỗi O tuần phải ghi: **đóng góp vào KR tháng nào**, **chỉ tiêu tuần là bao nhiêu** (lấy từ nhịp độ chia ngược). **Không dùng quy tắc 60%.** |
| **Tháng → Quý → Năm → Tầm nhìn** | Đo số | KR tháng là phân kỳ của KR quý, KR quý là mốc của KR năm. % tính từ số thực tế, **không tính trung bình từ cấp dưới**. |

- "Liên quan" ở Ngày → Tuần: đánh dấu thủ công kèm **lý do bắt buộc** ("khi mục này đạt, O cấp trên tiến lên như thế nào, đo bằng gì?").
- Không chặn lưu khi chưa đủ ngưỡng, **hiện cảnh báo đỏ** ở đầu trang và Dashboard.

---

## 4. Tiêu chí kiểm tra

### 4.1 Cấp Ngày và Tuần (giữ nguyên)

**Tiêu điểm (O): 6 ô tick:** S, M, A, R, T + **"Các KR đạt thì O có đạt không?"**

**KR:** 5 ô S-M-A-R-T cho từng KR + câu kiểm: *"Hoàn thành các KA này thì KR có đạt không? Còn làm gì nữa để KR đạt trọn vẹn?"* (kèm nút **+ Thêm KA**).

**KA:** động từ, cụ thể, có ô tick.

### 4.2 Cấp Tháng, Quý, Năm: mẫu KR bằng số

Mỗi KR bắt buộc có đủ trường, thiếu thì **không cho chốt**:

```
Từ [giá trị hiện tại]  →  [giá trị đích]  trước [ngày]  ·  Nguồn đo: [nguồn số liệu]
```

Ba câu kiểm thay cho SMART 6 ô:
1. Có con số (điểm bắt đầu và đích) không?
2. Có hạn và nguồn đo không?
3. Nếu **tất cả KR đạt** thì O có đạt không?

Cảnh báo (không chặn): KR bắt đầu bằng động từ hành động ("học", "chuẩn bị", "hoàn thiện") thì gợi ý viết lại thành kết quả đo được.

### 4.3 Cấp Tầm nhìn: điều kiện kiểm tra
Mỗi mục tiêu năm trong Tầm nhìn phải có ô **"Điều kiện kiểm tra"** (kiểm chứng được). **Chưa điền thì mục tiêu năm đó hiển thị trạng thái "chưa hợp lệ".**

### 4.4 Quy tắc thực thi chung
- Nút **"Chốt kế hoạch"** chỉ bật khi mọi ô bắt buộc của cấp đó đã đủ (ngày: O 6 ô, mỗi KR 5 ô, ≥ 3 KR; tháng trở lên: mọi KR đủ Từ-Đến-Hạn-Nguồn). Cho phép bỏ qua kèm lý do.
- Tick **M** mà chưa có con số đo thì cảnh báo.

---

## 5. Quy trình lập OKR cấp Ngày và Tuần (7 bước, giữ nguyên)

Wizard từng bước. Bước sau mở khi bước trước có nội dung tối thiểu.

| Bước | Tên | Việc phải làm |
|---|---|---|
| 1 | **1a. Quan sát: lịch cố định & cam kết** | Ghi việc đã chắc chắn: làm gì, với ai, khi nào, lời hứa. Tô vàng việc không dời được. Có ô Check. |
| 2 | **1b. Quan sát: vấn đề, nỗi đau, tồn đọng, cơ hội** | 3 ô: **Công việc/Tài chính**, **Mối quan hệ**, **Thân – Tâm – Trí**. Mỗi mục có ô *"Nếu không làm thì sao?"* (bắt buộc). |
| 3 | **2. Phân tích** | Tô đậm việc đủ điều kiện (nhân duyên) giải quyết ngay trong kỳ. |
| 4 | **3. Nguyên nhân lỗi** | Với mỗi việc tô đậm: 3 dòng **Tham, Sân, Si** + câu kiểm *"Nếu giải quyết nguyên nhân này, vấn đề có hết không?"* |
| 5 | **Tiêu điểm (O)** | 1 câu + 6 ô tick. |
| 6 | **KR1, KR2, KR3…** | Mỗi KR tick SMART. |
| 7 | **KA dưới mỗi KR** | Hành động cụ thể, có ô tick. |

Điểm bắt buộc:
- Làm bước 1 trước bước 2 (biết quỹ thời gian mới chọn được việc khả thi).
- **Ngày:** ≥ 3 KR (mặc định đúng 3, tối đa 4).
- **Tuần:** KR tuần = các O ngày (số lượng không cố định). Có thêm **Kiểm chứng 3 chiều** (§7). Có thêm ô **"Đóng góp vào KR tháng nào, chỉ tiêu tuần"** (lấy sẵn từ nhịp độ tháng).
- O phải xử lý **nguyên nhân bước 4**, không xử lý triệu chứng.

---

## 6. Quy trình Kaizen cấp Ngày và Tuần (4 bước, giữ nguyên)

Dải đầu trang hiển thị **Tiêu điểm + % hoàn thành** lấy tự động từ OKR.

| Bước | Tên | Việc phải làm |
|---|---|---|
| 1 | **Đo lường** | % hoàn thành tiêu điểm kỳ trước, **lấy tự động**, không nhập tay. |
| 2a | **Nhật ký** | Đã làm gì, kết quả, còn gì nữa. Chia Sáng/Chiều/Tối (ngày). Chỉ ghi sự thật. |
| 2b | **Nguyên nhân % tiêu điểm** | Nguyên nhân của cả thành công lẫn thất bại, tới tận cùng, **dừng ở nguyên nhân mình đổi được bằng 1 hành động**. Bôi đỏ từ khóa. |
| 3 | **Bài học** | Mỗi bài học gắn 1 từ khóa đỏ, kèm ô "dấu hiệu nhận biết". |
| 4 | **Hành động tiếp theo** | Tick SMART + tiêu chí thứ 6 "đưa được vào OKR kỳ tới". Tối đa 3 hành động/ngày. |

- Cuối bản (chữ đỏ): *Bản Kaizen đã cụ thể chưa? Bạn hài lòng chưa? Chưa thì chỗ nào? Ai có thể giúp? Liên hệ tham vấn ngay.* → có ô ghi tên người.
- Mỗi hành động có nút **"Chuyển thành KA/KR kỳ kế tiếp"** (tạo bản nháp).
- Kaizen **tuần** tổng hợp từ Kaizen các ngày (từ khóa đỏ lặp lại nhiều nhất, bài học trùng), người dùng chỉnh lại, **không nhập lại từ đầu**.

---

## 7. Kiểm chứng (chỉ ở Tuần và Tháng)

3 khối, mỗi khối có hàng 5 ô SMART riêng:

| Khối | Đối tượng |
|---|---|
| **Trên xuống** | Người chịu ảnh hưởng bởi mục tiêu của bạn |
| **Chéo** | Phòng ban/người khác bị ảnh hưởng |
| **Dưới lên** | Sếp, Thầy, Mentor (xin duyệt hướng đi) |

Mỗi dòng: tên người · đã hỏi ý kiến (tick) · ghi chú. Ở **Tháng/Quý**, kiểm chứng làm bằng **số liệu** (đưa bảng số liệu cho mentor xem), không bằng cảm nhận.

---

## 8. OKR cấp Tháng, Quý, Năm, Tầm nhìn (MỚI)

### 8.1 Tầm nhìn (rà 1 lần/năm)

Một trang. Mỗi mục tiêu theo năm có **điều kiện kiểm tra**:

| Năm | Mục tiêu (người dùng nhập, ví dụ) | Điều kiện kiểm tra (bắt buộc) |
|---|---|---|
| 1 | Thu nhập bằng lương + hệ thống chạy ổn định | Hệ thống tạo ≥ [X]/tháng liên tục [3] tháng; tôi giảm còn ≤ [Y] giờ/tuần |
| 2 | Thu nhập thụ động 200.000 USD/năm | Nghỉ 90 ngày, thu nhập giữ ≥ [Z]% |
| 3 | 500.000 USD/năm | Nhân bản bằng [đòn bẩy nào]: số người, thu nhập/người, tỷ lệ giữ chân |

Người dùng nhập giá trị riêng cho các ô trong ngoặc vuông. Ứng dụng **không tự đặt** con số.

### 8.2 Năm
- **1–3 O**, mỗi O có 3–4 KR theo mẫu số (§4.2).
- Mỗi KR được **chia ngược thành 4 mốc quý** (mỗi mốc là một giá trị số).
- Khi KR là thu nhập, KR phải đi kèm **Mô hình thu nhập** (§9).
- Với mục tiêu "thụ động": bắt buộc có ít nhất 1 KR về **đội ngũ tự vận hành** (vd: % thu nhập đến từ người mà tôi không trực tiếp làm việc cùng).

### 8.3 Quý (cấp điều chỉnh)
- 1–3 O, KR lấy từ mốc quý của năm (số).
- Chọn **1–2 dự án trọng tâm**, mọi thứ khác là việc nền.
- Đây là **nơi duy nhất được sửa kế hoạch năm**. Mọi sửa đổi tạo **phiên bản mới**, giữ bản gốc để so sánh, kèm lý do bằng số liệu (§11.4).

### 8.4 Tháng (mắt xích chống trì hoãn)

Mỗi KR tháng có đủ 4 phần:

| Phần | Nội dung |
|---|---|
| **Chỉ số kết quả** | Số lagging (vd: số người hoạt động mới = 10) |
| **Chỉ số dẫn trước** | Số leading (vd: cuộc gọi/tuần = 40, hẹn/tuần = 8) |
| **Nhịp độ chia ngược** | Tự tính: mỗi ngày ≥ n hành động (từ §9) |
| **Kế hoạch cộng dồn** | Mốc theo tuần (vd: T1 = 2, T2 = 5, T3 = 8, T4 = 10) |

- **Bỏ lưới "5 tuần × 7 ngày × 3 buổi"** ở bản tháng. Tháng không xếp lịch từng ngày. Bản tháng gồm: danh sách O, KR số, bảng kế hoạch cộng dồn, dự án trọng tâm, kiểm chứng.
- Tháng **không dùng Tham-Sân-Si và nhật ký**.

---

## 9. Mô hình thu nhập (MỚI)

Mô-đun nhập hệ số, ứng dụng tự tính nhịp độ chia ngược cho mọi cấp.

### Đầu vào (người dùng nhập, có thể đổi theo thời gian)

| Hệ số | Ý nghĩa |
|---|---|
| `target_income_month` | Thu nhập mục tiêu/tháng (có thể quy đổi từ USD/năm, tỷ giá nhập tay) |
| `avg_income_per_active` | Thu nhập TB mỗi người hoạt động tạo ra/tháng |
| `retention_rate_quarter` | Tỷ lệ giữ chân theo quý |
| `conv_call_to_appt` | Tỷ lệ cuộc gọi → hẹn |
| `conv_appt_to_join` | Tỷ lệ hẹn → vào hệ thống |
| `working_days_week` | Số ngày làm việc/tuần |
| `max_calls_per_day` | Công suất tối đa của một người/ngày |

### Phép tính

```
active_needed   = target_income_month / avg_income_per_active
recruit_needed  = active_needed / retention_rate_quarter  (điều chỉnh theo quý)
appt_needed     = recruit_needed / conv_appt_to_join
calls_needed    = appt_needed / conv_call_to_appt
=> calls/tuần, calls/ngày  (chia cho working_days_week)
```

Kết quả đưa vào: **nhịp độ chia ngược** ở KR tháng, **chỉ tiêu tuần** ở O tuần, **gợi ý số hành động/ngày** ở bản ngày.

### Quy tắc
- **Hệ số chưa biết** → đánh dấu "chưa đo". Ứng dụng tự đề xuất **KR "đo hệ số này"** cho 2 tháng đầu. Trong thời gian đó nhịp độ hiển thị là "ước lượng".
- Nếu `calls/ngày > max_calls_per_day` → **cảnh báo đỏ**: "Tăng nỗ lực cá nhân không đủ, cần KR về đội ngũ tự vận hành hoặc đòn bẩy". Bắt buộc thêm KR đội ngũ để chốt.
- Mục tiêu năm 2–3 gấp nhiều lần: hiển thị **hệ số nhân bản cần có** so với năm trước.
- Cho phép **nhiều mô hình** (mỗi nguồn thu nhập một mô hình: hoa hồng hệ thống, đầu tư, kinh doanh khác).

---

## 10. Công thức tính % hoàn thành

### 10.1 Ngày và Tuần (tick, giữ nguyên)
```
KA tick → % KR → % O ngày → % O tuần
```
| Chỉ số | Công thức mặc định |
|---|---|
| % KR | KA đã tick / tổng KA |
| % O ngày | trung bình % các KR của ngày |
| % O tuần | trung bình % các O ngày là KR tuần |

- Mặc định trung bình đơn giản; cho phép trọng số `weight` tùy chọn.
- Cài đặt `chỉ tính phần liên quan O` (mặc định bật). Hiển thị "% mục tiêu" và "% tổng".

### 10.2 Tháng, Quý, Năm (số liệu)
```
% KR số          = (thực tế − điểm bắt đầu) / (đích − điểm bắt đầu)
Tình trạng (TT)  = thực tế cộng dồn / kế hoạch cộng dồn tính đến hôm nay
% O              = trung bình (có trọng số tùy chọn) % KR
```
- **Không tính trung bình từ % ngày/tuần.** Số thực tế nhập (hoặc kéo từ chỉ số dẫn trước) từ nguồn đo.
- Chỉ số dẫn trước tháng có thể **tự cộng từ tuần** (vd: tổng cuộc gọi các tuần) nếu người dùng bật liên kết.
- **Hiển thị riêng từng KR**, không gộp che mất KR đang 0%. Dashboard luôn có bảng từng KR.

### 10.3 Màu và ngưỡng
| Màu | Điều kiện (Tình trạng) |
|---|---|
| Xanh | ≥ 90% |
| Vàng | 70–89% |
| Đỏ | < 70% |

Ngưỡng "đạt" của Kaizen ngày/tuần mặc định 80% (cài đặt).

---

## 11. Kaizen cấp Tháng, Quý, Năm (MỚI, thay cho khuôn nhật ký)

### 11.1 Năm bước

| Bước | Việc làm |
|---|---|
| 1. **Số liệu** | Bảng mỗi KR: kế hoạch cộng dồn · thực tế · chênh lệch · màu. Số **lấy tự động**. |
| 2. **Chẩn đoán** | Với mỗi KR vàng/đỏ, chọn **1 trong 4 nhóm nguyên nhân** rồi dùng số liệu chứng minh (§11.2). |
| 3. **Quyết định** | Mỗi KR chọn đúng 1: **Giữ · Tăng nỗ lực · Cắt phạm vi · Đổi cách làm · Dừng**. |
| 4. **Bài học** | Tối đa 3 câu, mỗi câu **kèm 1 con số** chứng minh. |
| 5. **Điều chỉnh** | Chỉ ở điểm rà (cuối tháng/quý/năm). Tạo **phiên bản kế hoạch mới** so với bản gốc. |

### 11.2 Bốn nhóm nguyên nhân (chẩn đoán)
| Nhóm | Nghĩa | Dấu hiệu bằng số |
|---|---|---|
| **(a) Đầu vào thiếu** | Làm chưa đủ | Chỉ số dẫn trước thấp hơn nhịp độ |
| **(b) Chuyển đổi thấp** | Làm đủ mà ít ra kết quả | Dẫn trước đạt, tỷ lệ chuyển đổi thấp hơn hệ số trong mô hình |
| **(c) Giữ chân kém** | Có người vào nhưng rời đi | Tỷ lệ giữ chân thực tế < hệ số |
| **(d) Yếu tố bên ngoài** | Thay đổi ngoài tầm kiểm soát | Ghi sự kiện cụ thể + ngày |

### 11.3 Luật kích hoạt (viết sẵn, mặc định bật)
- Trễ **> 20% hai tuần liên tiếp** → app **bắt buộc** chọn một quyết định ở bước 3 ngay tuần đó, không chờ cuối tháng.
- Trễ **> 30% ở một KR quý** → mở bước chẩn đoán đầy đủ.

### 11.4 Chống hạ mục tiêu để trốn việc
- Muốn **hạ** KR: nguyên nhân phải thuộc nhóm **(b), (c) hoặc (d)** kèm số liệu.
- Nguyên nhân thuộc nhóm **(a) (làm chưa đủ) không được phép hạ mục tiêu**, chỉ được chọn "Tăng nỗ lực".
- Mọi lần hạ ghi vào lịch sử phiên bản và hiện ở Dashboard ("đã hạ X lần").

### 11.5 Kiểm chứng
Cuối tháng/quý: đưa bảng số liệu cho người kiểm chứng (mentor/sếp) và ghi nhận xét (xem §7).

---

## 12. Nhịp rà và nhắc giờ

| Kỳ | Thời lượng | Nội dung |
|---|---|---|
| Ngày | 20–30 phút (mặc định nhắc 20:00) | Kaizen ngày + OKR ngày mai |
| Tuần | 30 phút, Chủ nhật | Kaizen tuần + OKR tuần mới, đối chiếu cộng dồn tháng |
| Tháng | 60 phút | Bảng số liệu + 5 bước Kaizen số liệu |
| Quý | 2–3 giờ | Rà KR, chỉnh hướng, chọn dự án trọng tâm |
| Năm | Nửa ngày | Rà Tầm nhìn, lập O năm sau |

Thứ tự lập kế hoạch: **Tầm nhìn → Năm → Quý → Tháng → Tuần → Ngày**.
Khi lập OKR ngày mai mà chưa có Kaizen hôm nay, hiện cảnh báo nhẹ.
**Buổi rà tháng và quý là cố định trên lịch**, bỏ qua phải ghi lý do.

---

## 13. Màn hình và giao diện

### Bố cục chung (Ngày, Tuần)
- Chia đôi: **Trái = OKRs**, **Phải = KAIZEN** (giống bản Excel gốc). Ô tiêu đề vàng nhạt, ô điền trắng, việc cố định vàng đậm, dải đỏ **TIÊU ĐIỂM + % HOÀN THÀNH**, chữ nhỏ dưới tiêu đề là câu hỏi gợi ý (placeholder/tooltip).

### Danh sách màn hình

1. **Dashboard:** thanh tình trạng Năm/Quý/Tháng (kế hoạch cộng dồn so với thực tế), % ngày/tuần, cảnh báo (60%, luật kích hoạt, công suất, hệ số "chưa đo", số lần hạ mục tiêu).
2. **Tầm nhìn:** 1 trang, mục tiêu theo năm + điều kiện kiểm tra, trạng thái hợp lệ.
3. **Năm / Quý:** O, KR số, mốc quý, dự án trọng tâm, lịch sử phiên bản.
4. **Tháng:** KR số (4 phần), bảng kế hoạch cộng dồn, kiểm chứng, Kaizen số liệu.
5. **Mô hình thu nhập:** nhập hệ số, xem kết quả nhịp độ.
6. **Tuần:** lưới **Thứ 2 → CN × Sáng/Chiều/Tối**; O ngày hiển thị như KR tuần kèm cờ "liên quan"; ô đóng góp vào KR tháng; kiểm chứng; Kaizen tuần.
7. **Ngày:** bảng giờ **04h30–22h30** (2 cột), ô Check, 3 khối KR cạnh nhau, Kaizen bên phải.
8. **Cây liên kết:** Tầm nhìn → Năm → Quý → Tháng → Tuần → Ngày → KR → KA, màu theo tình trạng.
9. **Lịch sử Kaizen:** tìm theo từ khóa đỏ, nhóm nguyên nhân, quyết định.
10. **Cài đặt** (§14).

### Yêu cầu trải nghiệm
Responsive (dùng được trên điện thoại buổi tối), lưu tự động, xuất **PDF/Excel** theo từng kỳ.

---

## 14. Cài đặt (đều đổi được)

| Cài đặt | Mặc định |
|---|---|
| Số KR ngày (tối thiểu / tối đa) | 3 / 4 |
| Ngưỡng liên quan Ngày → Tuần | 60% (và Ngày ≥ 1 KR) |
| Màu tình trạng | xanh ≥ 90, vàng 70–89, đỏ < 70 |
| Ngưỡng đạt Kaizen ngày/tuần | 80% |
| Luật kích hoạt | trễ > 20% × 2 tuần liên tiếp |
| Tính % chỉ phần liên quan O | Bật |
| Trọng số KA/KR | Tắt |
| Giờ nhắc Kaizen ngày | 20:00 |
| Tối đa hành động Kaizen/ngày | 3 |
| Tỷ giá USD ↔ VND | nhập tay |

---

## 15. Mô hình dữ liệu (đề xuất)

```
Vision            { id, items:[{year, goal, verification_condition, valid: bool}] }
PlanVersion       { id, period_id, version, is_original, created_at, reason, cause_group? }
Period            { id, type: year|quarter|month|week|day, start_date, end_date,
                    status: draft|locked, plan_version_id }
Objective         { id, period_id, title, smart?: {s,m,a,r,t}, kr_to_o_ok,
                    parent_id?, is_linked_to_parent, link_reason, percent }
KeyResult         { id, objective_id, title, kind: tick|numeric,
                    // kind=tick (Ngày/Tuần)
                    smart?: {s,m,a,r,t}, ka_complete_ok, source_objective_id?,
                    // kind=numeric (Tháng/Quý/Năm)
                    baseline, target, deadline, metric_source,
                    leading_indicators:[{name, target_per_period}],
                    cumulative_plan:[{date, planned}], actuals:[{date, value}],
                    income_model_id?, weight?, percent, status_color }
WeeklyContribution{ id, week_objective_id, month_kr_id, weekly_target, actual }
KeyAction         { id, key_result_id, title, done, weight? }
ScheduleItem      { id, period_id, date, time_from, time_to, title, people, fixed, done }
Observation       { id, period_id, category: work_finance|relationship|body_mind_wisdom,
                    content, consequence_if_ignored, is_selected }
RootCause         { id, observation_id, tham, san, si, note, resolve_check }
Validation        { id, period_id, direction: top_down|cross|bottom_up, person, asked,
                    smart?, note, data_attached? }
IncomeModel       { id, name, target_income_month, avg_income_per_active,
                    retention_rate_quarter, conv_call_to_appt, conv_appt_to_join,
                    working_days_week, max_calls_per_day, unknown_flags:[...] }
KaizenShort       { id, period_id(day|week), measured_percent(auto), assessment,
                    journal:[{slot,text}], causes, keywords, lessons:[{text, keyword_id, signal}],
                    next_actions:[{text, smart, can_go_into_next_okr, converted_to_id?}],
                    satisfied, consult_who }
KaizenLong        { id, period_id(month|quarter|year),
                    kr_snapshots:[{kr_id, planned, actual, gap, color}],
                    diagnoses:[{kr_id, cause_group: a|b|c|d, evidence}],
                    decisions:[{kr_id, decision: keep|increase|cut|change|stop, reason}],
                    lessons:[{text, number}], new_plan_version_id? }
TriggerLog        { id, kr_id, triggered_at, rule, decision_required, resolved }
Settings          { ... như §14 }
```

---

## 16. Điểm cần giả định (đã chọn mặc định, đều là cài đặt)

| # | Vấn đề | Giả định mặc định |
|---|---|---|
| 1 | Hệ số mô hình thu nhập chưa có | Đánh dấu "chưa đo", 2 tháng đầu tự gợi ý KR "đo hệ số" |
| 2 | Tỷ giá USD ↔ VND | Nhập tay, hiển thị rõ ngày cập nhật |
| 3 | Năm 1 bắt đầu từ tháng nào | Người dùng chọn ngày bắt đầu khi tạo Tầm nhìn |
| 4 | Ngày: ≥ 1 hay ≥ 2/3 KR liên quan O | ≥ 1 KR, cảnh báo nếu chỉ 1 |
| 5 | Nghĩa chữ R | "Quan trọng nhất trong các việc làm được kỳ này để đạt O" (chỉ nhãn gợi ý) |
| 6 | % Ngày/Tuần có trọng số không | Trung bình đơn giản, trọng số tùy chọn |
| 7 | Quy tắc dừng khi hỏi nguyên nhân (Ngày/Tuần) | Dừng ở nguyên nhân đổi được bằng 1 hành động cụ thể |
| 8 | Kiểm chứng ở bản ngày | Không có (chỉ Tuần/Tháng/Quý) |

---

## 16b. Cảnh báo logic ứng dụng phải xử lý

1. **KR viết như hành động** ở Tháng trở lên: chặn chốt nếu thiếu Từ-Đến-Hạn-Nguồn.
2. **Hệ số chưa đo mà vẫn lập kế hoạch**: nhịp độ hiển thị "ước lượng", nhắc đo.
3. **Bỏ buổi rà tháng/quý**: nhắc, ghi lý do bỏ.
4. **Mục tiêu vượt công suất cá nhân**: cảnh báo bắt buộc thêm KR đội ngũ.
5. **Hạ mục tiêu để trốn việc**: chặn nhóm nguyên nhân (a), ghi lịch sử.
6. **Tick M không có số**: cảnh báo.
7. **Trung bình che KR hỏng**: luôn hiển thị bảng từng KR.
8. **Hành động Kaizen phình ra**: giới hạn mềm 3/ngày.
9. **Ngày kín giờ (tới 22h30)**: nhắc giờ cố định cho Kaizen và OKR, thời lượng 20–30 phút.

---

## 17. Yêu cầu kỹ thuật gợi ý

- **Web app** (React/Next.js + TypeScript) hoặc PWA.
- Lưu trữ: bắt đầu **local-first** (IndexedDB/SQLite), đăng nhập và đồng bộ đám mây ở giai đoạn sau.
- Tầng logic tính toán tách riêng, có **unit test** cho: công thức % (tick và số), nhịp độ chia ngược, kế hoạch cộng dồn, luật kích hoạt, quy tắc chống hạ mục tiêu, quy tắc 60% ngày → tuần, chặn "Chốt kế hoạch".
- Xuất PDF/Excel.
- Dữ liệu mẫu: nạp ví dụ §18 để demo.

### Thứ tự xây dựng
1. **Mô hình dữ liệu + logic tính** (% tick, % số, nhịp độ chia ngược, cộng dồn) + test.
2. Trang **Ngày**: OKR 7 bước + Kaizen 4 bước.
3. Trang **Tuần**, liên kết Ngày → Tuần (60%), Kiểm chứng.
4. **Mô hình thu nhập** + trang **Tháng** (KR số, kế hoạch cộng dồn) + liên kết Tuần → Tháng.
5. Kaizen số liệu (4 nhóm nguyên nhân, quyết định, luật kích hoạt, phiên bản).
6. **Quý, Năm, Tầm nhìn.**
7. Dashboard, cây liên kết, nhắc giờ, xuất file.

---

## 18. Ví dụ dữ liệu mẫu

### 18.1 Ngày 02/12/2024 (giữ nguyên làm demo cấp Ngày)

**1a. Lịch cố định:** 04h30–06h15 trại X3K21 làm Mentor · 09h30–11h20 gọi Phonetem Droppii · 16h30–17h00 chạy bộ 5km · 19h00–21h00 lớp TikTok 3 góc K18.

**1b. Vấn đề:** Tuyển dụng chưa có kênh cá nhân hóa → nếu không làm, trượt mục tiêu Mentor 1*. Thân–Tâm–Trí: chạy 5km, thiền 1 giờ, đọc sách 20 phút, học video 30 phút.

**2. Phân tích (tô đậm):** kỹ năng tuyển dụng.
**3. Nguyên nhân:** Tham: mong cầu kết quả. Si: chưa biết cách làm hiệu quả, chưa đổi sau các buổi kaizen.

**O:** Hoàn thiện kỹ năng tuyển dụng Data Droppii. Hoàn thành: 73%.

| KR | % | KA |
|---|---|---|
| KR1 Trước: chuẩn bị 100% kịch bản, tâm thái | 100% | Đăng ký 5 data · Đọc lại kịch bản · Xem lại bài học hôm trước |
| KR2 Trong: thực hiện gọi và kaizen từng cuộc gọi 100% | 70% | Thực hiện cuộc gọi · Kaizen kịch bản cùng đồng đội · Ghi chú cuộc gọi · Đánh giá tỷ lệ đạt |
| KR3 Sau: kaizen đúc kết bài học ứng dụng | 50% | Đọc lại nhật ký cuộc gọi · Đọc lại Kaizen đồng đội · Đúc kết bài học, hành động tiếp theo · Chăm sóc chốt với PBB |

**Kaizen:** từ khóa đỏ: **chưa tập trung · mất năng lượng · không rõ tiêu điểm**. Bài học: Tự tạo năng lượng tích cực; Phân bổ thời gian rõ ràng cho mục tiêu. Hành động: Xác định mục tiêu SMART cho từng công việc · Phân bổ thời gian hợp lý · Hoàn thiện lộ trình TikTok 3 góc.

### 18.2 Mô hình thu nhập mẫu (số minh họa, thay bằng số thật của người dùng)

```
target_income_month      = 16.700 USD   (≈ 200.000 USD/năm)
avg_income_per_active    = 500 USD/tháng
→ active_needed          = 33–34 người hoạt động
retention_rate_quarter   = 60%
conv_call_to_appt        = 20%
conv_appt_to_join        = 25%
```
Ứng dụng tính ra số cuộc gọi/ngày cần chạy và so với `max_calls_per_day`. Nếu vượt, bật cảnh báo cần KR đội ngũ. **Đây chỉ là số minh họa**, không phải dự báo.

### 18.3 KR tháng mẫu (cấp Tháng)

```
O tháng: Xây nền hệ thống để chạy ổn định
KR1  Số người hoạt động mới: từ 0 → 10, trước 31/12, nguồn: bảng theo dõi hệ thống
       Dẫn trước: 40 cuộc gọi/tuần · 8 hẹn/tuần
       Cộng dồn:  T1=2  T2=5  T3=8  T4=10
KR2  Hệ số chuyển đổi gọi → hẹn: đo xong và ghi nhận trước 15/12 (KR "đo hệ số")
```

---

## 19. Câu lệnh gợi ý để giao cho Claude

> Hãy đọc kỹ file `OKR_KAIZEN_APP_SPEC.md` (v2). Trước hết tóm tắt lại bạn hiểu gì về: (1) hai vòng lặp ngắn/dài, (2) khác biệt giữa liên kết Ngày → Tuần ("là KR của", quy tắc 60%) và Tuần → Tháng ("đóng góp vào" chỉ tiêu), (3) công thức % cho tick và cho số liệu. Sau đó làm **giai đoạn 1** (mô hình dữ liệu + toàn bộ logic tính + unit test) rồi dừng lại cho tôi xem trước khi sang giai đoạn tiếp theo. Mọi ngưỡng ở §14 là cài đặt, không hard-code. Giao diện tiếng Việt.
