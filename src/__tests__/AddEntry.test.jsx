import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddEntry from '../components/AddEntry'

const defaultForm = { type: 'expense', category: 'Housing', amount: '', description: '' }

function renderAddEntry(overrides = {}) {
  const props = {
    form: defaultForm,
    setForm: vi.fn(),
    onSubmit: vi.fn(),
    dark: false,
    ...overrides,
  }
  render(<AddEntry {...props} />)
  return props
}

describe('AddEntry', () => {
  it('renders income and expense toggle buttons', () => {
    renderAddEntry()
    expect(screen.getByRole('button', { name: /income/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expense/i })).toBeInTheDocument()
  })

  it('shows category grid when type is expense', () => {
    renderAddEntry({ form: { ...defaultForm, type: 'expense' } })
    expect(screen.getByRole('button', { name: /Housing/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Groceries/i })).toBeInTheDocument()
  })

  it('hides category grid when type is income', () => {
    renderAddEntry({ form: { ...defaultForm, type: 'income' } })
    expect(screen.queryByRole('button', { name: /Groceries/i })).not.toBeInTheDocument()
  })

  it('calls onSubmit when Add Entry is clicked', async () => {
    const user = userEvent.setup()
    const props = renderAddEntry()
    await user.click(screen.getByRole('button', { name: /add entry/i }))
    expect(props.onSubmit).toHaveBeenCalledOnce()
  })

  it('calls setForm when amount changes', async () => {
    const user = userEvent.setup()
    const props = renderAddEntry()
    const amountInput = screen.getByPlaceholderText('0')
    await user.type(amountInput, '5')
    expect(props.setForm).toHaveBeenCalled()
  })

  it('calls setForm when description changes', async () => {
    const user = userEvent.setup()
    const props = renderAddEntry()
    const descInput = screen.getByPlaceholderText('What was this for?')
    await user.type(descInput, 'test')
    expect(props.setForm).toHaveBeenCalled()
  })
})
