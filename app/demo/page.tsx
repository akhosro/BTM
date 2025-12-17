"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Zap, ArrowRight, CheckCircle2 } from "lucide-react"

export default function DemoPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    jobTitle: "",
    phone: "",
    facilityType: "",
    message: "",
  })
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error("Failed to submit demo request")
      }

      setIsSubmitted(true)
    } catch (error) {
      console.error("Error submitting demo request:", error)
      alert("Failed to submit demo request. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        {/* Navigation */}
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/landing" className="flex items-center gap-2">
                <Zap className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold">Enalysis</span>
              </Link>
            </div>
          </div>
        </nav>

        {/* Success Message */}
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Card>
              <CardContent className="pt-12 pb-12">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-3xl font-bold mb-4">Thank You!</h1>
                <p className="text-lg text-muted-foreground mb-8">
                  We've received your demo request. Our team will reach out to you within 24 hours to schedule a time that works best for you.
                </p>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    In the meantime, check your email for a confirmation and some helpful resources about Enalysis.
                  </p>
                  <Button size="lg" asChild>
                    <Link href="/landing">
                      Back to Home
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/landing" className="flex items-center gap-2">
              <Zap className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">Enalysis</span>
            </Link>
            <Button variant="ghost" asChild>
              <Link href="/landing">Back to Home</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Demo Request Form */}
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Schedule Your Demo</h1>
            <p className="text-xl text-muted-foreground">
              See how Enalysis can reduce your energy costs by 20-30% and cut carbon emissions by 25%
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>What to Expect</CardTitle>
              <CardDescription>
                Our 30-minute demo will show you:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-8">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Real-time energy monitoring across all your facilities</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>AI-powered forecasting that predicts demand 24 hours ahead</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Automated recommendations to reduce costs and emissions</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>ROI calculation specific to your facility</span>
                </li>
              </ul>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Work Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    name="company"
                    placeholder="Acme Manufacturing"
                    value={formData.company}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title *</Label>
                    <Input
                      id="jobTitle"
                      name="jobTitle"
                      placeholder="Energy Manager"
                      value={formData.jobTitle}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facilityType">Facility Type *</Label>
                  <Input
                    id="facilityType"
                    name="facilityType"
                    placeholder="e.g., Manufacturing Plant, Data Center, Office Building"
                    value={formData.facilityType}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Additional Information (Optional)</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Tell us about your energy challenges or goals..."
                    value={formData.message}
                    onChange={handleChange}
                    rows={4}
                  />
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    "Submitting..."
                  ) : (
                    <>
                      Request Demo
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  We'll contact you within 24 hours to schedule your personalized demo
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
