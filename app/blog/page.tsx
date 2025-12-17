import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, ArrowLeft, Calendar, Clock } from "lucide-react"

export default function BlogPage() {
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
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">Enalysis Blog</h1>
            <p className="text-xl text-muted-foreground">
              Insights on energy management, AI optimization, and sustainability
            </p>
          </div>

          <div className="grid gap-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4" />
                  <span>December 16, 2025</span>
                  <Clock className="h-4 w-4 ml-4" />
                  <span>5 min read</span>
                </div>
                <CardTitle className="text-2xl">
                  How to Reduce Peak Demand Charges by 30%
                </CardTitle>
                <CardDescription>
                  Peak demand charges can account for 30-50% of your electricity bill. Learn how AI-powered
                  forecasting helps you avoid these costly spikes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Most facilities don't realize they're being charged based on their highest 15-minute power
                  usage of the month. This single metric can cost thousands of dollars...
                </p>
                <Button variant="outline" disabled>Coming Soon</Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4" />
                  <span>December 10, 2025</span>
                  <Clock className="h-4 w-4 ml-4" />
                  <span>7 min read</span>
                </div>
                <CardTitle className="text-2xl">
                  Energy Management Software Buyer's Guide 2025
                </CardTitle>
                <CardDescription>
                  What to look for when choosing an energy management platform for your facility.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  The energy management software market has evolved rapidly. Here's what separates
                  modern AI-driven platforms from legacy systems...
                </p>
                <Button variant="outline" disabled>Coming Soon</Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4" />
                  <span>December 5, 2025</span>
                  <Clock className="h-4 w-4 ml-4" />
                  <span>4 min read</span>
                </div>
                <CardTitle className="text-2xl">
                  Case Study: Data Center Reduces Costs 28% with AI
                </CardTitle>
                <CardDescription>
                  How a mid-sized data center saved $127K annually using predictive energy optimization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  When this Toronto-based data center approached us, they were spending $450K/year on
                  electricity. Six months later, their costs dropped to $324K...
                </p>
                <Button variant="outline" disabled>Coming Soon</Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center pt-8">
            <p className="text-muted-foreground mb-4">
              Want to learn more about optimizing your facility's energy?
            </p>
            <Button size="lg" asChild>
              <Link href="/signup">
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
