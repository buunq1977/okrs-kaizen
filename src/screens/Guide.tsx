import { Fragment, useMemo } from 'react'
import guide from '../../docs/HUONG-DAN.md?raw'
import { parseMd, type Block, type Inline } from '../lib/md'

/** Trang Hướng dẫn: vẽ thẳng docs/HUONG-DAN.md (một nguồn cho repo và app). Sửa hướng dẫn thì sửa file .md. */
export default function Guide() {
  const blocks = useMemo(() => parseMd(guide), [])
  const toc = blocks.filter((b): b is Extract<Block, { t: 'h' }> => b.t === 'h' && b.level === 2)
  const jump = (id: string) => document.getElementById('g-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div className="stack guide">
      <nav className="guide-toc" aria-label="Mục lục hướng dẫn">
        {toc.map((h) => (
          <button key={h.id} className="chip" onClick={() => jump(h.id)}>
            {h.raw}
          </button>
        ))}
      </nav>
      <article className="guide-body">
        {blocks.map((b, i) => (
          <BlockView key={i} b={b} />
        ))}
      </article>
    </div>
  )
}

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case 'h': {
      const H = (`h${Math.min(4, b.level)}` as 'h1' | 'h2' | 'h3' | 'h4')
      return (
        <H id={'g-' + b.id}>
          <Text v={b.text} />
        </H>
      )
    }
    case 'p':
      return (
        <p>
          <Text v={b.text} />
        </p>
      )
    case 'quote':
      return (
        <p className="note guide-quote">
          <Text v={b.text} />
        </p>
      )
    case 'ul':
    case 'ol': {
      const L = b.t
      return (
        <L>
          {b.items.map((it, i) => (
            <li key={i}>
              <Text v={it} />
            </li>
          ))}
        </L>
      )
    }
    case 'table':
      return (
        <div className="guide-tw">
          <table className="ktable">
            <thead>
              <tr>
                {b.head.map((c, i) => (
                  <th key={i}>
                    <Text v={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>
                      <Text v={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'hr':
      return null
  }
}

function Text({ v }: { v: Inline[] }) {
  return (
    <>
      {v.map((x, i) => (
        <Fragment key={i}>
          {x.t === 'b' ? (
            <b>{x.v}</b>
          ) : x.t === 'code' ? (
            <code>{x.v}</code>
          ) : x.t === 'a' ? (
            <a href={x.href} target="_blank" rel="noreferrer">
              {x.v}
            </a>
          ) : (
            x.v
          )}
        </Fragment>
      ))}
    </>
  )
}
