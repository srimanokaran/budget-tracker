import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formatCurrency } from '../constants'

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => ({
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
}))

import Dashboard from '../components/Dashboard'

const sampleEntries = [
  { id: 1, type: 'income', category: 'Income', amount: 5000, description: 'Salary', date: '2025-01-01' },
  { id: 2, type: 'expense', category: 'Housing', amount: 1500, description: 'Rent', date: '2025-01-05' },
  { id: 3, type: 'expense', category: 'Groceries', amount: 500, description: 'Woolworths', date: '2025-01-10' },
]

function renderDashboard(overrides = {}) {
  const props = {
    entries: sampleEntries,
    goals: { monthlyBudget: 6000, monthlySavings: 2000 },
    currentMonth: '2025-01',
    dark: false,
    setFilterCategory: vi.fn(),
    setFilterType: vi.fn(),
    setView: vi.fn(),
    ...overrides,
  }
  render(<Dashboard {...props} />)
  return props
}

describe('Dashboard', () => {
  it('displays correct income, expenses and balance totals', () => {
    renderDashboard()
    const incomeStr = formatCurrency(5000)
    const expensesStr = formatCurrency(2000)
    const balanceStr = formatCurrency(3000)
    // Income stat
    expect(screen.getAllByText(incomeStr).length).toBeGreaterThanOrEqual(1)
    // Expenses stat
    expect(screen.getAllByText(expensesStr).length).toBeGreaterThanOrEqual(1)
    // Balance stat
    expect(screen.getAllByText(balanceStr).length).toBeGreaterThanOrEqual(1)
  })

  it('shows green savings rate when >= 20%', () => {
    // balance=3000, income=5000 → savings rate = 60%
    renderDashboard()
    const rateEl = screen.getByText('60.0%')
    expect(rateEl.style.color).toBe('rgb(27, 153, 139)') // #1b998b
  })

  it('shows orange savings rate when >= 0% but < 20%', () => {
    const entries = [
      { id: 1, type: 'income', category: 'Income', amount: 5000, description: 'Salary', date: '2025-01-01' },
      { id: 2, type: 'expense', category: 'Housing', amount: 4500, description: 'Rent', date: '2025-01-05' },
    ]
    renderDashboard({ entries })
    const rateEl = screen.getByText('10.0%')
    expect(rateEl.style.color).toBe('rgb(224, 124, 36)') // #e07c24
  })

  it('shows red savings rate when < 0%', () => {
    const entries = [
      { id: 1, type: 'income', category: 'Income', amount: 1000, description: 'Salary', date: '2025-01-01' },
      { id: 2, type: 'expense', category: 'Housing', amount: 2000, description: 'Rent', date: '2025-01-05' },
    ]
    renderDashboard({ entries })
    const rateEl = screen.getByText('-100.0%')
    expect(rateEl.style.color).toBe('rgb(233, 69, 96)') // #e94560
  })

  it('clicking a category calls setFilterCategory and setView', async () => {
    const user = userEvent.setup()
    const props = renderDashboard()
    // Find the Housing text in the spending breakdown and click its row
    const housingLabel = screen.getByText(/Housing/, { selector: 'span' })
    const row = housingLabel.closest('[style]')
    await user.click(row)
    expect(props.setFilterCategory).toHaveBeenCalledWith('Housing')
    expect(props.setView).toHaveBeenCalledWith('history')
  })
})
