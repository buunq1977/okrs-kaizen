/* Đọc markdown đơn giản (đủ cho docs/HUONG-DAN.md): tiêu đề, đoạn, danh sách -, 1., bảng, ---, trích dẫn >,
   chữ đậm **, `code`, [chữ](link). Trả về khối dữ liệu để React vẽ, không dùng innerHTML. Logic thuần. */
export type Inline = { t: 'text' | 'b' | 'code'; v: string } | { t: 'a'; v: string; href: string }
export type Block =
  | { t: 'h'; level: number; text: Inline[]; id: string; raw: string }
  | { t: 'p'; text: Inline[] }
  | { t: 'quote'; text: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][] }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'hr' }

/** Chữ trong 1 dòng: `code` trước, rồi **đậm**, rồi [chữ](link). */
export function parseInline(s: string): Inline[] {
  const out: Inline[] = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push({ t: 'text', v: s.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] })
    else if (m[2] !== undefined) out.push({ t: 'b', v: m[2] })
    else out.push({ t: 'a', v: m[3], href: m[4] })
    last = re.lastIndex
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) })
  return out
}

/** Mã neo cho tiêu đề: bỏ dấu, chữ thường, nối bằng '-'. */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'))
const isSep = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)

export function parseMd(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const out: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      out.push({ t: 'h', level: h[1].length, text: parseInline(h[2].trim()), id: slug(h[2]), raw: h[2].trim() })
      i++
      continue
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push({ t: 'hr' })
      i++
      continue
    }
    if (line.trim().startsWith('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cells(line).map(parseInline)
      const rows: Inline[][][] = []
      i += 2
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]).map(parseInline))
      out.push({ t: 'table', head, rows })
      continue
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''))
      out.push({ t: 'quote', text: parseInline(buf.join(' ')) })
      continue
    }
    const li = /^\s*([-*]|\d+\.)\s+/
    if (li.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length && lines[i].trim()) {
        if (li.test(lines[i])) items.push(lines[i].replace(li, ''))
        else items[items.length - 1] += ' ' + lines[i].trim() // dòng nối của mục trước
        i++
        if (i < lines.length && li.test(lines[i]) && /^\s*\d+\./.test(lines[i]) !== ordered) break
      }
      out.push({ t: ordered ? 'ol' : 'ul', items: items.map(parseInline) })
      continue
    }
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[i]) && !/^\s*-{3,}\s*$/.test(lines[i])) buf.push(lines[i++].trim())
    if (!buf.length) buf.push(lines[i++].trim())
    out.push({ t: 'p', text: parseInline(buf.join(' ')) })
  }
  return out
}
