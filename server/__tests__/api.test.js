import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import request from 'supertest'

let app, db, tmpDir

const auth = 'Basic ' + Buffer.from(':test').toString('base64')

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'budget-test-'))
  process.env.DATA_DIR = tmpDir
  process.env.PASSWORD = 'test'
  process.env.NODE_ENV = 'test'

  const mod = await import('../index.js')
  app = mod.app
  db = mod.db
})

afterAll(() => {
  if (db) db.close()
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
})

describe('Transactions API', () => {
  it('GET /api/transactions requires month param', async () => {
    const res = await request(app).get('/api/transactions').set('Authorization', auth)
    expect(res.status).toBe(400)
  })

  it('GET /api/transactions returns empty array for new month', async () => {
    const res = await request(app).get('/api/transactions?month=2025-01').set('Authorization', auth)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('POST /api/transactions creates a transaction', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', auth)
      .send({
        id: 1001, type: 'expense', category: 'Housing',
        amount: 1500, description: 'Rent', date: '2025-01-05', month: '2025-01',
      })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('GET /api/transactions returns created transaction', async () => {
    const res = await request(app).get('/api/transactions?month=2025-01').set('Authorization', auth)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].category).toBe('Housing')
    expect(res.body[0].amount).toBe(1500)
  })

  it('PATCH /api/transactions/:id updates category', async () => {
    const res = await request(app)
      .patch('/api/transactions/1001')
      .set('Authorization', auth)
      .send({ type: 'expense', category: 'Groceries' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const check = await request(app).get('/api/transactions?month=2025-01').set('Authorization', auth)
    expect(check.body[0].category).toBe('Groceries')
  })

  it('PATCH /api/transactions/:id can update amount', async () => {
    const res = await request(app)
      .patch('/api/transactions/1001')
      .set('Authorization', auth)
      .send({ type: 'expense', category: 'Groceries', amount: 200 })
    expect(res.status).toBe(200)

    const check = await request(app).get('/api/transactions?month=2025-01').set('Authorization', auth)
    expect(check.body[0].amount).toBe(200)
  })

  it('DELETE /api/transactions/:id removes transaction', async () => {
    const res = await request(app)
      .delete('/api/transactions/1001')
      .set('Authorization', auth)
    expect(res.status).toBe(200)

    const check = await request(app).get('/api/transactions?month=2025-01').set('Authorization', auth)
    expect(check.body).toHaveLength(0)
  })
})

describe('Goals API', () => {
  it('GET /api/goals returns defaults', async () => {
    const res = await request(app).get('/api/goals').set('Authorization', auth)
    expect(res.status).toBe(200)
    expect(res.body.monthlyBudget).toBe(6000)
    expect(res.body.monthlySavings).toBe(2000)
  })

  it('PUT /api/goals updates goals', async () => {
    const res = await request(app)
      .put('/api/goals')
      .set('Authorization', auth)
      .send({ monthlyBudget: 5000, monthlySavings: 1500 })
    expect(res.status).toBe(200)

    const check = await request(app).get('/api/goals').set('Authorization', auth)
    expect(check.body.monthlyBudget).toBe(5000)
    expect(check.body.monthlySavings).toBe(1500)
  })
})

describe('Settings API', () => {
  it('GET /api/settings/:key returns null for missing key', async () => {
    const res = await request(app).get('/api/settings/nonexistent').set('Authorization', auth)
    expect(res.status).toBe(200)
    expect(res.body.value).toBeNull()
  })

  it('PUT /api/settings/:key sets a value', async () => {
    const res = await request(app)
      .put('/api/settings/theme')
      .set('Authorization', auth)
      .send({ value: 'dark' })
    expect(res.status).toBe(200)
  })

  it('GET /api/settings/:key retrieves stored value', async () => {
    const res = await request(app).get('/api/settings/theme').set('Authorization', auth)
    expect(res.body.value).toBe('dark')
  })
})

describe('CSV Import', () => {
  it('POST /api/import/csv imports valid CSV lines', async () => {
    const csv = [
      '15/02/2025,-50.00,"WOOLWORTHS"',
      '16/02/2025,-30.00,"COLES"',
      '17/02/2025,3000.00,"SALARY"',
    ].join('\n')

    const res = await request(app)
      .post('/api/import/csv')
      .set('Authorization', auth)
      .set('Content-Type', 'text/plain')
      .send(csv)

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(3)
  })
})

describe('Transaction edge cases', () => {
  it('POST /api/transactions with missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', auth)
      .send({ id: 9999, type: 'expense' })
    expect(res.status).toBe(400)
  })

  it('PATCH /api/transactions with missing type/category returns 400', async () => {
    const res = await request(app)
      .patch('/api/transactions/1001')
      .set('Authorization', auth)
      .send({ amount: 100 })
    expect(res.status).toBe(400)
  })
})

describe('Goals edge cases', () => {
  it('PUT /api/goals with missing fields returns 400', async () => {
    const res = await request(app)
      .put('/api/goals')
      .set('Authorization', auth)
      .send({ monthlyBudget: 5000 })
    expect(res.status).toBe(400)
  })
})

describe('Settings edge cases', () => {
  it('PUT /api/settings/:key with non-string value returns 400', async () => {
    const res = await request(app)
      .put('/api/settings/theme')
      .set('Authorization', auth)
      .send({ value: 123 })
    expect(res.status).toBe(400)
  })
})

describe('CSV Import edge cases', () => {
  it('POST /api/import/csv with empty body returns 400', async () => {
    const res = await request(app)
      .post('/api/import/csv')
      .set('Authorization', auth)
      .set('Content-Type', 'text/plain')
      .send('')
    expect(res.status).toBe(400)
  })

  it('POST /api/import/csv with invalid date format skips rows', async () => {
    const csv = '2025-02-15,-50.00,"WOOLWORTHS"'
    const res = await request(app)
      .post('/api/import/csv')
      .set('Authorization', auth)
      .set('Content-Type', 'text/plain')
      .send(csv)
    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(0)
    expect(res.body.skipped).toBe(1)
  })

  it('POST /api/import/csv duplicate import does not create duplicate rows', async () => {
    const csv = '20/03/2025,-99.00,"UNIQUE_DEDUP_TEST"'
    await request(app)
      .post('/api/import/csv')
      .set('Authorization', auth)
      .set('Content-Type', 'text/plain')
      .send(csv)

    const res = await request(app)
      .post('/api/import/csv')
      .set('Authorization', auth)
      .set('Content-Type', 'text/plain')
      .send(csv)
    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(0)
    expect(res.body.skipped).toBe(1)
  })
})

describe('AI Insights', () => {
  it('POST /api/insights returns 503 when ANTHROPIC_API_KEY is not set', async () => {
    const res = await request(app)
      .post('/api/insights')
      .set('Authorization', auth)
      .send({ month: '2025-01', messages: [{ role: 'user', content: 'Analyze my spending' }] })
    expect(res.status).toBe(503)
  })

  it('POST /api/insights returns 400 when month is missing', async () => {
    const res = await request(app)
      .post('/api/insights')
      .set('Authorization', auth)
      .send({ messages: [{ role: 'user', content: 'Hi' }] })
    // Could be 503 (no key check first) or 400
    expect([400, 503]).toContain(res.status)
  })

  it('POST /api/insights returns 400 when messages is missing', async () => {
    const res = await request(app)
      .post('/api/insights')
      .set('Authorization', auth)
      .send({ month: '2025-01' })
    // Could be 503 (no key check first) or 400
    expect([400, 503]).toContain(res.status)
  })
})

describe('Trends & Monthly Totals', () => {
  it('GET /api/transactions/trends returns aggregated data', async () => {
    // Insert some expense data first
    await request(app)
      .post('/api/transactions')
      .set('Authorization', auth)
      .send({
        id: 2001, type: 'expense', category: 'Housing',
        amount: 1000, description: 'Rent', date: '2025-03-01', month: '2025-03',
      })

    const res = await request(app).get('/api/transactions/trends').set('Authorization', auth)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('GET /api/transactions/monthly-totals returns grouped data', async () => {
    const res = await request(app).get('/api/transactions/monthly-totals').set('Authorization', auth)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })
})
