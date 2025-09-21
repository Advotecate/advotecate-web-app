// Payment API Routes - Connected to Your GCP PostgreSQL Database
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

// GET /api/payments - List payments/donations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await query(`
      SELECT
        d.id,
        d.amount,
        d.currency,
        d.status,
        d.is_recurring,
        d.created_at,
        d.processed_at,
        pm.type as payment_method_type,
        pm.brand,
        pm.last_four_digits
      FROM payments.donations d
      LEFT JOIN payments.payment_methods pm ON d.payment_method_id = pm.id
      ORDER BY d.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return NextResponse.json({
      success: true,
      payments: result.rows,
      total: result.rowCount
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

// POST /api/payments - Create new payment/donation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      amount,
      currency = 'USD',
      payment_method_id,
      fundraiser_id,
      organization_id,
      donor_id,
      guest_donor_info,
      is_recurring = false,
      recurring_frequency
    } = body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    // Insert donation record
    const result = await query(`
      INSERT INTO payments.donations (
        amount, currency, payment_method_id, fundraiser_id,
        organization_id, donor_id, guest_donor_info,
        is_recurring, recurring_frequency, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING id, amount, currency, status, created_at
    `, [
      amount, currency, payment_method_id, fundraiser_id,
      organization_id, donor_id, guest_donor_info ? JSON.stringify(guest_donor_info) : null,
      is_recurring, recurring_frequency
    ]);

    const donation = result.rows[0];

    // Log transaction event
    await query(`
      INSERT INTO payments.transaction_events (donation_id, event_type, event_status, event_data)
      VALUES ($1, 'created', 'success', $2)
    `, [donation.id, JSON.stringify({ created_via: 'api' })]);

    return NextResponse.json({
      success: true,
      donation: donation
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}