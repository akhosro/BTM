import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, ArrowLeft } from "lucide-react"

export default function TermsPage() {
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
            <h1 className="text-5xl font-bold tracking-tight">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: December 16, 2025</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Agreement to Terms</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                By accessing or using the Enalysis platform, you agree to be bound by these Terms of Service
                and all applicable laws and regulations. If you do not agree with any of these terms, you are
                prohibited from using this service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Use License</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                Enalysis grants you a limited, non-exclusive, non-transferable license to use the platform
                for your internal business purposes, subject to these Terms.
              </p>
              <p>You may not:</p>
              <ul>
                <li>Modify or copy the platform materials</li>
                <li>Use the platform for any commercial purpose outside your organization</li>
                <li>Attempt to reverse engineer any software contained in the platform</li>
                <li>Remove any copyright or proprietary notations</li>
                <li>Transfer the platform to another person or entity</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Responsibilities</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>You are responsible for:</p>
              <ul>
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Ensuring your use complies with all applicable laws</li>
                <li>Providing accurate and complete information</li>
                <li>Notifying us immediately of any unauthorized use of your account</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Availability</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                We strive to maintain high availability of our platform, but we do not guarantee uninterrupted
                or error-free service. We may:
              </p>
              <ul>
                <li>Temporarily suspend service for maintenance</li>
                <li>Modify or discontinue features with notice</li>
                <li>Limit access to certain features based on your subscription plan</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Terms</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                Subscription fees are based on your usage and facility size. You agree to:
              </p>
              <ul>
                <li>Pay all fees associated with your subscription plan</li>
                <li>Provide valid payment information</li>
                <li>Authorize automatic renewal unless you cancel before the renewal date</li>
              </ul>
              <p>
                We offer a free trial period. After the trial, you will be charged according to your selected plan unless you cancel.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cancellation and Refunds</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                You may cancel your subscription at any time. Upon cancellation:
              </p>
              <ul>
                <li>You will retain access until the end of your current billing period</li>
                <li>No refunds will be provided for partial months</li>
                <li>Your data will be retained for 30 days before deletion</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                All content, features, and functionality of the Enalysis platform are owned by Enalysis Inc.
                and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p>
                Your energy data remains your property. We only use it to provide services to you as described
                in our Privacy Policy.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                Enalysis provides energy management recommendations based on AI forecasting. While we strive
                for accuracy, actual results may vary based on your facility, usage patterns, and other factors.
                You are responsible for final decisions regarding energy management actions.
              </p>
              <p>
                The platform is provided "as is" without warranties of any kind. In no event shall Enalysis be
                liable for any indirect, incidental, special, consequential, or punitive damages arising from
                your use of the platform, except where prohibited by law.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                We may update these Terms of Service from time to time. We will notify you of significant
                changes via email or through the platform. Your continued use of the service after changes
                constitutes acceptance of the new terms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                If you have questions about these Terms of Service, please contact us at:
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
