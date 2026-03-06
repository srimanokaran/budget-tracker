import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Goals from '../components/Goals'
import { formatCurrency } from '../constants'

const defaultProps = {
  goals: { monthlyBudget: 6000, monthlySavings: 2000 },
  editGoals: { monthlyBudget: 6000, monthlySavings: 2000 },
  setEditGoals: vi.fn(),
  saveGoals: vi.fn(),
  dark: false,
}

describe('Goals', () => {
  it('renders budget and savings inputs with values from editGoals', () => {
    render(<Goals {...defaultProps} />)
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs[0]).toHaveValue(6000)
    expect(inputs[1]).toHaveValue(2000)
  })

  it('displays annual income needed = (budget + savings) * 12', () => {
    render(<Goals {...defaultProps} />)
    // (6000 + 2000) * 12 = 96000
    const expected = formatCurrency(96000)
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('displays daily spending allowance = budget / 30', () => {
    render(<Goals {...defaultProps} />)
    const expected = formatCurrency(6000 / 30)
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('displays weekly spending allowance = budget / 4.33', () => {
    render(<Goals {...defaultProps} />)
    const expected = formatCurrency(6000 / 4.33)
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('calls saveGoals on button click', async () => {
    const user = userEvent.setup()
    const props = { ...defaultProps, saveGoals: vi.fn() }
    render(<Goals {...props} />)
    await user.click(screen.getByRole('button', { name: /save goals/i }))
    expect(props.saveGoals).toHaveBeenCalledOnce()
  })
})
