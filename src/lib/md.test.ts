import { describe, expect, it } from 'vitest'
import { parseInline, parseMd, slug } from './md'
import guide from '../../docs/HUONG-DAN.md?raw'

describe('parseInline', () => {
  it('đậm, code, link, chữ thường', () => {
    expect(parseInline('Bấm **Lưu** ở `Cài đặt` xem [app](https://x.vn) nhé')).toEqual([
      { t: 'text', v: 'Bấm ' },
      { t: 'b', v: 'Lưu' },
      { t: 'text', v: ' ở ' },
      { t: 'code', v: 'Cài đặt' },
      { t: 'text', v: ' xem ' },
      { t: 'a', v: 'app', href: 'https://x.vn' },
      { t: 'text', v: ' nhé' },
    ])
  })
  it('không có ký hiệu thì giữ nguyên', () => {
    expect(parseInline('a → b')).toEqual([{ t: 'text', v: 'a → b' }])
  })
})

describe('slug', () => {
  it('bỏ dấu tiếng Việt', () => {
    expect(slug('3. Ngày (Hôm nay / Ngày mai)')).toBe('3-ngay-hom-nay-ngay-mai')
    expect(slug('Đăng nhập')).toBe('dang-nhap')
  })
})

describe('parseMd', () => {
  it('tiêu đề, đoạn, danh sách, bảng, hr, trích dẫn', () => {
    const b = parseMd(['# Tên', '', 'Dòng 1', 'dòng 2', '', '- a', '- b', '', '1. x', '2. y', '', '| A | B |', '|---|---|', '| 1 | 2 \\| 3 |', '', '---', '> chú ý'].join('\n'))
    expect(b.map((x) => x.t)).toEqual(['h', 'p', 'ul', 'ol', 'table', 'hr', 'quote'])
    expect(b[1]).toEqual({ t: 'p', text: [{ t: 'text', v: 'Dòng 1 dòng 2' }] })
    const tb = b[4] as Extract<(typeof b)[number], { t: 'table' }>
    expect(tb.rows[0][1]).toEqual([{ t: 'text', v: '2 | 3' }])
  })
  it('đọc được file hướng dẫn thật: có tiêu đề mục và bảng', () => {
    const b = parseMd(guide)
    expect(b[0]).toMatchObject({ t: 'h', level: 1 })
    expect(b.filter((x) => x.t === 'h' && x.level === 2).length).toBeGreaterThanOrEqual(8)
    expect(b.some((x) => x.t === 'table')).toBe(true)
    // không còn dấu ** hay | lọt ra ngoài thành chữ thường
    const flat = JSON.stringify(b.filter((x) => x.t === 'p' || x.t === 'ul' || x.t === 'ol'))
    expect(flat).not.toContain('**')
  })
})
