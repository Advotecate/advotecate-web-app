import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Advotecate
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Political engagement & fundraising platform combining ActBlue's fundraising with Mobilize's event organization
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/demo-donation">
              <Button variant="donate" size="lg">
                Demo Donation
              </Button>
            </Link>
            <Link href="/about">
              <Button variant="outline" size="lg">
                Learn More
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Secure Donations</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Process political donations securely with full FEC compliance and real-time validation.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Organize and manage political events, rallies, and volunteer activities.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance First</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Built-in compliance monitoring and reporting for campaign finance regulations.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
