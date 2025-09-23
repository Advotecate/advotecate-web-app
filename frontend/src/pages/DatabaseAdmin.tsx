// Database Admin Panel - Test Your PostgreSQL Connection
import { useState, useEffect } from 'react';

interface DatabaseStats {
  schemaname: string;
  tablename: string;
  inserts: number;
  updates: number;
  deletes: number;
}

interface DatabaseStatus {
  success: boolean;
  status: string;
  database?: string;
  host?: string;
  tables?: DatabaseStats[];
  timestamp: string;
  error?: string;
  details?: {
    message?: string;
    host?: string;
    port?: string;
    database?: string;
    solution?: string;
    deployment_script?: string;
    type?: string;
    code?: string;
  };
}

export default function DatabaseAdminPage() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);

  const checkDatabaseStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/database/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error checking database status:', error);
      setStatus({
        success: false,
        status: 'error',
        database: '',
        host: '',
        tables: [],
        timestamp: new Date().toISOString(),
        error: 'Failed to connect to database API'
      });
    }
    setLoading(false);
  };

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/payments');
      const data = await response.json();
      if (data.success) {
        setPayments(data.payments);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const createTestPayment = async () => {
    try {
      const testPayment = {
        amount: 25.00,
        currency: 'USD',
        organization_id: '550e8400-e29b-41d4-a716-446655440000',
        guest_donor_info: {
          name: 'Test Donor',
          email: 'test@example.com'
        }
      };

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayment),
      });

      const data = await response.json();
      if (data.success) {
        alert('Test payment created successfully!');
        fetchPayments();
      } else {
        alert('Failed to create payment: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating test payment:', error);
    }
  };

  useEffect(() => {
    checkDatabaseStatus();
    fetchPayments();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Database Admin Panel</h1>
          <p className="text-gray-600 mt-2">PostgreSQL Connection Status & Payment System Test</p>
        </div>

        {/* Database Status Card */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Database Status</h2>
            <button
              onClick={checkDatabaseStatus}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>

          {status && (
            <div className={`p-4 rounded-md ${status.success ? 'bg-mint-50 border border-mint-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${status.success ? 'bg-mint-600' : 'bg-red-500'}`}></div>
                <span className={`font-medium ${status.success ? 'text-mint-800' : 'text-red-800'}`}>
                  {status.success ? 'Connected' : 'Connection Failed'}
                </span>
              </div>

              {status.success ? (
                <div className="mt-3 text-sm text-gray-600">
                  <p><strong>Database:</strong> {status.database}</p>
                  <p><strong>Host:</strong> {status.host}</p>
                  <p><strong>Last Check:</strong> {new Date(status.timestamp).toLocaleString()}</p>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-sm text-red-700 mb-2"><strong>Error:</strong> {status.error}</p>

                  {status.details && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-3">
                      <h4 className="text-sm font-medium text-yellow-800 mb-2">🔧 Solution Required</h4>
                      {status.details.message && (
                        <p className="text-sm text-yellow-700 mb-2">{status.details.message}</p>
                      )}
                      {status.details.solution && (
                        <p className="text-sm text-yellow-700 mb-2"><strong>Solution:</strong> {status.details.solution}</p>
                      )}
                      {status.details.deployment_script && (
                        <p className="text-sm text-yellow-700 mb-2">
                          <strong>Run:</strong> <code className="bg-yellow-100 px-1 py-0.5 rounded">{status.details.deployment_script}</code>
                        </p>
                      )}
                      <div className="text-xs text-yellow-600 mt-2">
                        <p><strong>Connection Details:</strong></p>
                        <p>Host: {status.details.host}, Port: {status.details.port}, Database: {status.details.database}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Database Tables */}
        {status?.success && status.tables && (
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Database Tables</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schema</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inserts</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updates</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deletes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {status.tables.map((table, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{table.schemaname}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{table.tablename}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{table.inserts}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{table.updates}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{table.deletes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payments Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Payments / Donations</h2>
            <div className="space-x-2">
              <button
                onClick={fetchPayments}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
              >
                Refresh Payments
              </button>
              <button
                onClick={createTestPayment}
                className="bg-mint-600 hover:bg-mint-700 text-white px-4 py-2 rounded-md"
              >
                Create Test Payment
              </button>
            </div>
          </div>

          {payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {payment.id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${payment.amount} {payment.currency}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          payment.status === 'completed' ? 'bg-mint-100 text-mint-800' :
                          payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payment.payment_method_type || 'N/A'}
                        {payment.brand && ` (${payment.brand})`}
                        {payment.last_four_digits && ` ****${payment.last_four_digits}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(payment.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No payments found. Create a test payment to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}