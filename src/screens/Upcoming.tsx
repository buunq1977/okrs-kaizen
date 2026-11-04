/** Trang chưa làm: báo rõ giai đoạn nào trong SPEC §17 sẽ làm. */
export function Upcoming({ title, what }: { title: string; what: string }) {
  return (
    <div className="stack narrow">
      <h1>{title}</h1>
      <p className="empty">{what}</p>
    </div>
  )
}
