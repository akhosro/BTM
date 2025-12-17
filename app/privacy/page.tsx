import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, ArrowLeft } from "lucide-react"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Zap className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">Enalysis</span>
            </Link>
            <Button variant="ghost" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: December 16, 2025</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Introduction</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                At Enalysis, we take your privacy seriously. This Privacy Policy explains how we collect,
                use, disclose, and safeguard your information when you use our energy management platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <h3>Account Information</h3>
              <p>
                When you create an account, we collect your name, email address, company name, and job title.
              </p>

              <h3>Energy Data</h3>
              <p>
                We collect energy consumption data from your meters and IoT devices, including:
              </p>
              <ul>
                <li>Real-time energy consumption readings</li>
                <li>Solar production data (if applicable)</li>
                <li>Battery storage levels (if applicable)</li>
                <li>Facility location and grid zone information</li>
              </ul>

              <h3>Usage Information</h3>
              <p>
                We automatically collect information about how you use our platform, including pages visited,
                features used, and time spent on the platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>We use the information we collect to:</p>
              <ul>
                <li>Provide and maintain our energy management services</li>
                <li>Generate AI-powered forecasts and recommendations</li>
                <li>Send you important updates about your account and energy usage</li>
                <li>Improve our platform and develop new features</li>
                <li>Comply with legal obligations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Security</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                We implement security measures to protect your data, including:
              </p>
              <ul>
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security reviews</li>
                <li>Access controls and authentication</li>
                <li>Secure cloud infrastructure</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Sharing</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                We do not sell your personal information. We may share your data only in the following circumstances:
              </p>
              <ul>
                <li>With your explicit consent</li>
                <li>With service providers who help us operate our platform (under strict confidentiality agreements)</li>
                <li>To comply with legal obligations or law enforcement requests</li>
                <li>In connection with a merger, acquisition, or sale of assets</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>You have the right to:</p>
              <ul>
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Export your data in a portable format</li>
              </ul>
              <p>
                To exercise these rights, please contact us at info@enalysis.com
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                If you have questions about this Privacy Policy, please contact us at:
              </p>
              <p>
                <strong>Email:</strong> info@enalysis.com<br />
                <strong>Address:</strong> Enalysis Inc., Toronto, ON, Canada
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
