import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import History from '../components/History'

const sampleEntries = [
  { id: 1, type: 'expense', category: 'Housing', amount: 1500, description: 'Rent', date: '2025-01-05' },
  { id: 2, type: 'expense', category: 'Groceries', amount: 200, description: 'Woolworths', date: '2025-01-06' },
  { id: 3, type: 'income', category: 'Income', amount: 5000, description: 'Salary', date: '2025-01-01' },
]

function renderHistory(overrides = {}) {
  const props = {
    entries: sampleEntries,
    dark: false,
    monthLabel: 'Jan 2025',
    filterCategory: null,
    setFilterCategory: vi.fn(),
    filterType: null,
    setFilterType: vi.fn(),
    editingId: null,
    setEditingId: vi.fn(),
    deleteEntry: vi.fn(),
    reclassifyEntry: vi.fn(),
    ...overrides,
  }
  render(<History {...props} />)
  return props
}

describe('History', () => {
  it('filters entries by category', () => {
    renderHistory({ filterCategory: 'Housing' })
    expect(screen.getByText(/Rent/)).toBeInTheDocument()
    expect(screen.queryByText(/Woolworths/)).not.toBeInTheDocument()
  })

  it('filters entries by type', () => {
    renderHistory({ filterType: 'income' })
    expect(screen.getByText(/Salary/)).toBeInTheDocument()
    expect(screen.queryByText(/Rent/)).not.toBeInTheDocument()
  })

  it('shows "No entries yet" when empty', () => {
    renderHistory({ entries: [] })
    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument()
  })

  it('shows filtered message when filter active and no matches', () => {
    renderHistory({ entries: sampleEntries, filterCategory: 'Entertainment' })
    expect(screen.getByText(/no entertainment transactions/i)).toBeInTheDocument()
  })

  it('shows Clear filter button when filter is set', () => {
    renderHistory({ filterCategory: 'Housing' })
    expect(screen.getByRole('button', { name: /clear filter/i })).toBeInTheDocument()
  })

  it('does not show Clear filter when no filter', () => {
    renderHistory()
    expect(screen.queryByRole('button', { name: /clear filter/i })).not.toBeInTheDocument()
  })

  it('Clear filter calls setFilterCategory(null) and setFilterType(null)', async () => {
    const user = userEvent.setup()
    const props = renderHistory({ filterCategory: 'Housing' })
    await user.click(screen.getByRole('button', { name: /clear filter/i }))
    expect(props.setFilterCategory).toHaveBeenCalledWith(null)
    expect(props.setFilterType).toHaveBeenCalledWith(null)
  })

  it('delete button calls deleteEntry(id)', async () => {
    const user = userEvent.setup()
    const props = renderHistory()
    // × is the delete button text
    const deleteButtons = screen.getAllByRole('button', { name: '×' })
    await user.click(deleteButtons[0])
    expect(props.deleteEntry).toHaveBeenCalledWith(sampleEntries[0].id)
  })

  it('edit pencil toggles editing', async () => {
    const user = userEvent.setup()
    const props = renderHistory()
    const editButtons = screen.getAllByRole('button', { name: /✏️/ })
    await user.click(editButtons[0])
    expect(props.setEditingId).toHaveBeenCalled()
  })
})
