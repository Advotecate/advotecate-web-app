// Advotecate Frontend - Payment System
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import DatabaseAdmin from './pages/DatabaseAdmin';
import DemoDonation from './pages/DemoDonation';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import OrganizationPage from './pages/Organization';
import FundraiserPage from './pages/FundraiserPage';
import EditFundraiserPage from './pages/EditFundraiserPage';

function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            Advotecate Payment System
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Political donation platform with FEC compliance and secure payment processing
          </p>
          <div className="flex justify-center space-x-4 mb-12">
            <Link
              to="/login"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="inline-block border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white px-6 py-3 rounded-md font-medium transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Demo Donation Card */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Demo Donation
            </h2>
            <p className="text-gray-600 mb-4">
              Try the donation form with mock data - no real payments will be processed
            </p>
            <Link
              to="/demo"
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
            >
              Try Demo
            </Link>
          </div>

          {/* Database Admin Card */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Database Admin
            </h2>
            <p className="text-gray-600 mb-4">
              Test your PostgreSQL database connection and view payment data
            </p>
            <Link
              to="/admin/database"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
            >
              Access Database Admin
            </Link>
          </div>

          {/* Payment API Card */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Payment API
            </h2>
            <p className="text-gray-600 mb-4">
              RESTful API endpoints for payment processing and donation management
            </p>
            <div className="space-y-2">
              <div className="text-sm">
                <code className="bg-gray-100 px-2 py-1 rounded">GET /api/payments</code>
                <span className="text-gray-600 ml-2">List payments</span>
              </div>
              <div className="text-sm">
                <code className="bg-gray-100 px-2 py-1 rounded">POST /api/payments</code>
                <span className="text-gray-600 ml-2">Create payment</span>
              </div>
              <div className="text-sm">
                <code className="bg-gray-100 px-2 py-1 rounded">GET /api/database/status</code>
                <span className="text-gray-600 ml-2">Database status</span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Payment System Features
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure Processing</h3>
              <p className="text-gray-600">Bank-grade encryption and secure payment processing</p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">FEC Compliance</h3>
              <p className="text-gray-600">Built-in compliance tracking and reporting for political donations</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">PostgreSQL Database</h3>
              <p className="text-gray-600">Robust database with audit trails and transaction history</p>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-16 bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 text-center">
            System Status
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="text-gray-900 font-medium">PostgreSQL Database</span>
              <span className="ml-auto text-green-600">Connected</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="text-gray-900 font-medium">Payment API</span>
              <span className="ml-auto text-green-600">Active</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="text-gray-900 font-medium">GCP Infrastructure</span>
              <span className="ml-auto text-green-600">Running</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
              <span className="text-gray-900 font-medium">Environment</span>
              <span className="ml-auto text-blue-600">Production</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/demo" element={<DemoDonation />} />
          <Route path="/admin/database" element={<DatabaseAdmin />} />

          {/* Authentication routes */}
          <Route
            path="/login"
            element={
              <ProtectedRoute requireAuth={false}>
                <Login />
              </ProtectedRoute>
            }
          />
          <Route
            path="/register"
            element={
              <ProtectedRoute requireAuth={false}>
                <Register />
              </ProtectedRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/org/:slug"
            element={
              <ProtectedRoute>
                <OrganizationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/org/:orgSlug/fundraiser/:fundraiserSlug"
            element={
              <ProtectedRoute>
                <FundraiserPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/org/:orgSlug/fundraiser/:fundraiserSlug/edit"
            element={
              <ProtectedRoute>
                <EditFundraiserPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;