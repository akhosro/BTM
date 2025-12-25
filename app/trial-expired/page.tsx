import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Calendar, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export default function TrialExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Your Free Trial Has Ended</CardTitle>
          <CardDescription className="text-base">
            Thank you for trying Enalysis! Your 14-day free trial has expired.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              During your trial, you experienced the power of AI-driven energy optimization.
              Continue saving money and reducing your carbon footprint by upgrading to a paid plan.
            </p>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">What you'll keep with a paid subscription:</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Real-time energy monitoring and analytics</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>AI-powered battery optimization recommendations</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Carbon-aware energy scheduling</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Automated data sync from solar and utility providers</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Unlimited sites and meters</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="flex-1">
              <Link href="/contact">
                <Calendar className="mr-2 h-4 w-4" />
                Upgrade Now
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/api/auth/logout">
                Sign Out
              </Link>
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Have questions? <Link href="/contact" className="text-primary hover:underline">Contact us</Link> to discuss pricing options.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
