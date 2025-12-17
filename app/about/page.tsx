import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, ArrowLeft, Target, Users, Lightbulb } from "lucide-react"

export default function AboutPage() {
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
            <h1 className="text-5xl font-bold tracking-tight">About Enalysis</h1>
            <p className="text-xl text-muted-foreground">
              We're on a mission to make energy management intelligent, automated, and accessible.
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Target className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl">Our Mission</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-4">
              <p>
                Enalysis was founded to solve a simple problem: buildings waste 20-30% of their energy costs
                because they can't predict when demand will spike or when energy prices will change.
              </p>
              <p>
                We built an AI-powered platform that predicts energy demand 24 hours ahead and automatically
                optimizes buildings to reduce costs and carbon emissions. Our customers save $5-15K per month
                per facility while reducing their environmental impact by 25%.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Lightbulb className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl">How We're Different</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-4">
              <p>
                Traditional energy management systems are reactive - they show you what happened yesterday.
                Enalysis is predictive - we tell you what will happen tomorrow so you can act today.
              </p>
              <p>
                Our platform uses advanced AI to forecast consumption, integrate weather data, optimize
                battery storage, and shift loads to cheaper, cleaner times - all automatically.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl">Who We Serve</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <h4 className="font-semibold mb-2">Manufacturing</h4>
                  <p className="text-sm text-muted-foreground">
                    Reduce peak demand charges and optimize production schedules
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Data Centers</h4>
                  <p className="text-sm text-muted-foreground">
                    Balance compute loads with energy pricing and grid conditions
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Commercial Real Estate</h4>
                  <p className="text-sm text-muted-foreground">
                    Optimize HVAC, lighting, and EV charging across portfolios
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center pt-8">
            <Button size="lg" asChild>
              <Link href="/login">
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
