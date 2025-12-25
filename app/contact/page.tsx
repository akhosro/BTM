import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, MapPin, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact Us - Enalysis Energy Management",
  description: "Get in touch with Enalysis to learn how AI-powered energy optimization can reduce your facility's electricity costs by 20-30%.",
  openGraph: {
    title: "Contact Enalysis - AI Energy Optimization",
    description: "Schedule a demo to see how we can reduce your energy costs by 20-30%.",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-primary">
              Enalysis
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Get in Touch</h1>
            <p className="text-xl text-muted-foreground">
              Ready to reduce your energy costs by 20-30%? Let's talk.
            </p>
          </div>

          {/* Contact Options Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Demo Request */}
            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader>
                <MessageSquare className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Request a Demo</CardTitle>
                <CardDescription>
                  See how Enalysis can optimize your facility's energy usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/demo">
                  <Button className="w-full" size="lg">
                    Schedule Demo
                  </Button>
                </Link>
                <p className="text-sm text-muted-foreground mt-4">
                  15-minute demo • No commitment • See real savings potential
                </p>
              </CardContent>
            </Card>

            {/* Email Contact */}
            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader>
                <Mail className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Email Us</CardTitle>
                <CardDescription>
                  General inquiries and partnership opportunities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a href="mailto:info@enalysis.io">
                  <Button variant="outline" className="w-full" size="lg">
                    info@enalysis.io
                  </Button>
                </a>
                <p className="text-sm text-muted-foreground mt-4">
                  We typically respond within 24 hours
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Contact Information */}
          <div className="bg-muted/30 rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Other Ways to Reach Us</h2>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Phone */}
              <div className="flex items-start gap-4">
                <Phone className="h-6 w-6 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Phone</h3>
                  <a
                    href="tel:+16479991234"
                    className="text-primary hover:underline"
                  >
                    +1 (647) 999-1234
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">
                    Mon-Fri, 9 AM - 6 PM EST
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-4">
                <MapPin className="h-6 w-6 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Location</h3>
                  <p className="text-muted-foreground">
                    Toronto, Ontario<br />
                    Canada
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Serving clients across North America
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-12 text-center">
            <div className="bg-primary/5 rounded-lg p-8 border border-primary/20">
              <h2 className="text-2xl font-bold mb-4">
                Ready to Start Saving?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Join leading facilities that have reduced their energy costs by 20-30%
                with AI-powered optimization. No upfront costs, no long-term contracts.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/demo">
                  <Button size="lg">
                    Schedule Free Demo
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="outline" size="lg">
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* FAQ Quick Links */}
          <div className="mt-12">
            <h2 className="text-xl font-bold mb-4 text-center">
              Common Questions
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pricing</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Performance-based pricing. You only pay when you save.
                  </p>
                  <Link href="/demo">
                    <Button variant="link" className="p-0">
                      Learn more →
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Implementation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    6-8 week setup. No hardware required. Works with existing systems.
                  </p>
                  <Link href="/blog/buyers-guide-2025">
                    <Button variant="link" className="p-0">
                      Read guide →
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">ROI</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Typical payback: 3-6 months. Average savings: 20-30%.
                  </p>
                  <Link href="/blog/data-center-case-study">
                    <Button variant="link" className="p-0">
                      View case study →
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Enalysis. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
