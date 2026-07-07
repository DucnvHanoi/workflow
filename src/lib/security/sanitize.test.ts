import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from './sanitize'

describe('sanitizeHtml', () => {
  it('strips <script> tags', () => {
    const out = sanitizeHtml('<p>hi</p><script>alert(1)</script>')
    expect(out).toContain('<p>hi</p>')
    expect(out.toLowerCase()).not.toContain('<script')
  })

  it('strips event-handler attributes', () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)">')
    expect(out.toLowerCase()).not.toContain('onerror')
  })

  it('strips javascript: URLs', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>')
    expect(out.toLowerCase()).not.toContain('javascript:')
  })

  it('preserves normal formatting', () => {
    const out = sanitizeHtml(
      '<h2>Title</h2><p><strong>bold</strong> and <a href="https://x.com">link</a></p>'
    )
    expect(out).toContain('<h2>')
    expect(out).toContain('<strong>')
    expect(out).toContain('href="https://x.com"')
  })
})
