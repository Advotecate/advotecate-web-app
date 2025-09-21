import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DonationSuccessPage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  const donationId = searchParams.id

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <CardTitle className="text-2xl text-green-800">
                Thank You for Your Donation!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-gray-600">
                  Your contribution has been successfully processed and will help make a difference in our democratic process.
                </p>

                {donationId && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">
                      Donation ID: <span className="font-mono font-semibold">{donationId}</span>
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">What happens next?</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• You'll receive a confirmation email with your receipt</li>
                    <li>• Your donation will be reported for compliance as required</li>
                    <li>• You can track the impact of your contribution online</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <Link href="/">
                  <Button variant="outline">
                    Return Home
                  </Button>
                </Link>
                <Link href="/demo-donation">
                  <Button>
                    Make Another Donation
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'Donation Successful | Advotecate',
    description: 'Thank you for your donation to support democracy.',
  }
}