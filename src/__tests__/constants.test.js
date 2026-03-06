import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatCurrency, getStyles, apiFetch } from '../constants'

describe('formatCurrency', () => {
  it('formats numbers as AUD currency', () => {
    expect(formatCurrency(1000)).toBe('$1,000')
    expect(formatCurrency(0)).toBe('$0')
    expect(formatCurrency(1234567)).toBe('$1,234,567')
  })

  it('formats negative numbers', () => {
    const result = formatCurrency(-500)
    expect(result).toContain('500')
  })
})

describe('getStyles', () => {
  it('returns dark card background when dark=true', () => {
    const styles = getStyles(true)
    expect(styles.card.background).toBe('#1c1c1f')
  })

  it('returns light card background when dark=false', () => {
    const styles = getStyles(false)
    expect(styles.card.background).toBe('#fff')
  })

  it('returns an input style object', () => {
    const styles = getStyles(false)
    expect(styles.input).toBeDefined()
    expect(styles.input.width).toBe('100%')
  })
})

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects to /login on 401', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 401 })
    vi.stubGlobal('fetch', mockFetch)

    // Mock window.location
    delete window.location
    window.location = { href: '' }

    await expect(apiFetch('/api/test')).rejects.toThrow('Unauthorized')
    expect(window.location.href).toBe('/login')
  })

  it('returns response on success', async () => {
    const mockResponse = { status: 200, json: () => Promise.resolve({ ok: true }) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    const res = await apiFetch('/api/test')
    expect(res.status).toBe(200)
  })
})
