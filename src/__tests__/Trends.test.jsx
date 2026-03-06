import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock recharts
vi.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
}))

import Trends from '../components/Trends'

const trendsData = [
  { month: '2025-01', Housing: 1500, Groceries: 400 },
  { month: '2025-02', Housing: 1500, Groceries: 350 },
]

const trendsCategories = new Set(['Housing', 'Groceries'])
const trendsCatFilter = new Set(['Housing', 'Groceries'])
const trendsMonthFilter = new Set(['2025-01', '2025-02'])

function renderTrends(overrides = {}) {
  const props = {
    trendsData,
    trendsCategories,
    trendsCatFilter,
    setTrendsCatFilter: vi.fn(),
    trendsMonthFilter,
    setTrendsMonthFilter: vi.fn(),
    dark: false,
    ...overrides,
  }
  render(<Trends {...props} />)
  return props
}

describe('Trends', () => {
  it('renders category filter buttons', () => {
    renderTrends()
    expect(screen.getByRole('button', { name: /Housing/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Groceries/ })).toBeInTheDocument()
  })

  it('renders month filter buttons', () => {
    renderTrends()
    expect(screen.getByRole('button', { name: /Jan 25/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Feb 25/ })).toBeInTheDocument()
  })

  it('shows None toggle when all categories selected', () => {
    renderTrends()
    // There are two None buttons (categories + months), both all-selected
    const noneButtons = screen.getAllByRole('button', { name: 'None' })
    expect(noneButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('shows All when no categories selected', () => {
    renderTrends({ trendsCatFilter: new Set(), trendsMonthFilter: new Set() })
    const allButtons = screen.getAllByRole('button', { name: 'All' })
    expect(allButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('clicking None toggle calls setTrendsCatFilter', async () => {
    const user = userEvent.setup()
    const props = renderTrends()
    const noneButtons = screen.getAllByRole('button', { name: 'None' })
    await user.click(noneButtons[0])
    expect(props.setTrendsCatFilter).toHaveBeenCalled()
  })

  it('shows empty state when trendsData is empty', () => {
    renderTrends({ trendsData: [], trendsCategories: new Set(), trendsCatFilter: new Set(), trendsMonthFilter: new Set() })
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument()
  })
})
