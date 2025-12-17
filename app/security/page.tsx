import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, ArrowLeft, Shield, Lock, Eye, Server, FileCheck, AlertTriangle } from "lucide-react"

export default function SecurityPage() {
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
            <Shield className="h-16 w-16 text-primary mx-auto" />
            <h1 className="text-5xl font-bold tracking-tight">Security</h1>
            <p className="text-xl text-muted-foreground">
              Your data security is our top priority
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Security Overview</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                Enalysis implements enterprise-grade security measures to protect your energy data and
                personal information. Our security program is built on industry best practices and
                continuously evolves to address emerging threats.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Lock className="h-6 w-6 text-primary" />
                  <CardTitle>Data Encryption</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                <p>All data is encrypted in transit and at rest to protect your information.</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li>• HTTPS enforced on all connections</li>
                  <li>• Encrypted database storage</li>
                  <li>• Secure API communications</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Eye className="h-6 w-6 text-primary" />
                  <CardTitle>Access Controls</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                <p>Strict access controls ensure only authorized users can access your data.</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li>• Multi-factor authentication (MFA)</li>
                  <li>• Role-based access control (RBAC)</li>
                  <li>• Session management and timeout</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Server className="h-6 w-6 text-primary" />
                  <CardTitle>Infrastructure Security</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                <p>Our platform runs on secure, monitored cloud infrastructure.</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li>• Secure cloud hosting</li>
                  <li>• DDoS protection</li>
                  <li>• Automated daily backups</li>
                  <li>• Network isolation</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FileCheck className="h-6 w-6 text-primary" />
                  <CardTitle>Compliance & Auditing</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                <p>Regular audits and compliance with industry standards.</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li>• Regular security reviews</li>
                  <li>• Activity logging and monitoring</li>
                  <li>• Compliance with privacy regulations</li>
                  <li>• Secure development practices</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-primary" />
                <CardTitle>Incident Response</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                We have procedures in place to quickly address any security concerns:
              </p>
              <ul>
                <li>Security monitoring and alerts</li>
                <li>Incident response procedures</li>
                <li>Prompt notification of affected users</li>
                <li>Transparent communication during incidents</li>
                <li>Post-incident analysis and improvements</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Privacy</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>Your energy data belongs to you. We:</p>
              <ul>
                <li>Never sell your data to third parties</li>
                <li>Only use your data to provide our services</li>
                <li>Allow you to export your data at any time</li>
                <li>Delete your data upon request (within 30 days)</li>
                <li>Comply with GDPR, CCPA, and other privacy regulations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employee Access</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                Enalysis employees have limited access to customer data:
              </p>
              <ul>
                <li>Access is granted on a need-to-know basis</li>
                <li>All access is logged and audited</li>
                <li>Employees undergo security training</li>
                <li>Background checks for all staff</li>
                <li>Strict confidentiality agreements</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Report a Security Issue</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                If you discover a security vulnerability, please report it to us immediately:
              </p>
              <p>
                <strong>Email:</strong> info@enalysis.com<br />
                <strong>Response Time:</strong> We aim to respond within 24 hours
              </p>
              <p>
                We appreciate responsible disclosure and will work with you to address any issues promptly.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
