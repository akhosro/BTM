import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Zap, ArrowLeft, Calendar, Clock } from "lucide-react"

export default function CaseStudyBlogPost() {
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
              <Link href="/blog">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Blog
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Article */}
      <article className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Calendar className="h-4 w-4" />
              <span>December 5, 2025</span>
              <Clock className="h-4 w-4 ml-4" />
              <span>4 min read</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Case Study: Data Center Reduces Costs 28% with AI
            </h1>
            <p className="text-xl text-muted-foreground">
              How a mid-sized data center saved $127K annually using predictive energy optimization.
            </p>
          </div>

          <Card>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none pt-6">
              <h2>The Challenge</h2>
              <p>
                When this Toronto-based colocation data center approached us in early 2025, they were spending
                $450,000 per year on electricity to power and cool their 500-rack facility. Their energy costs
                had increased 35% over the previous two years due to:
              </p>
              <ul>
                <li>Rising electricity rates in Ontario</li>
                <li>Expanding customer demand requiring more servers</li>
                <li>Inconsistent cooling efficiency across different times of day</li>
                <li>Peak demand charges from simultaneous server deployments</li>
              </ul>
              <p>
                The facility manager knew they were overspending but didn't have visibility into where the waste
                was occurring or how to fix it without impacting uptime-a non-negotiable requirement for their
                enterprise customers.
              </p>

              <h2>The Baseline Analysis</h2>
              <p>
                We started with a two-week data collection period, integrating with:
              </p>
              <ul>
                <li>Building Management System (BMS) for HVAC controls</li>
                <li>PDU (Power Distribution Unit) meters for rack-level consumption</li>
                <li>Utility interval data showing 15-minute power consumption</li>
                <li>Weather data and external temperature sensors</li>
              </ul>
              <p>
                The analysis revealed three major inefficiencies:
              </p>

              <h3>Issue 1: Cooling Over-Provisioning</h3>
              <p>
                The facility's cooling system was running at maximum capacity 24/7, regardless of actual heat load.
                During low-utilization periods (nights and weekends), they were cooling empty aisles to the same
                temperature as fully-loaded server racks.
              </p>
              <p>
                <strong>Cost impact:</strong> $180,000/year in wasted cooling energy
              </p>

              <h3>Issue 2: Peak Demand Spikes</h3>
              <p>
                New server deployments happened during business hours when the facility was already near peak load.
                This caused demand spikes that set the monthly demand charge-even though the servers could have been
                powered on at 2 AM with zero operational impact.
              </p>
              <p>
                <strong>Cost impact:</strong> $72,000/year in avoidable demand charges
              </p>

              <h3>Issue 3: Missed Time-of-Use Optimization</h3>
              <p>
                Ontario's time-of-use electricity rates vary significantly throughout the day. The facility wasn't
                taking advantage of off-peak rates for flexible workloads like backup systems testing, battery
                conditioning, or pre-cooling during cheap overnight hours.
              </p>
              <p>
                <strong>Cost impact:</strong> $35,000/year in missed savings opportunities
              </p>

              <h2>The Solution</h2>
              <h3>Phase 1: Predictive Cooling Optimization (Weeks 1-4)</h3>
              <p>
                We deployed AI models that predict heat load 24 hours ahead based on:
              </p>
              <ul>
                <li>Historical server utilization patterns</li>
                <li>Scheduled maintenance and deployments</li>
                <li>External temperature forecasts</li>
                <li>Day-of-week and seasonal trends</li>
              </ul>
              <p>
                The system automatically adjusts cooling setpoints and airflow to match predicted needs rather than
                running at maximum capacity. During the first month, this reduced cooling energy consumption by 32%
                with zero impact on server temperatures or uptime.
              </p>

              <h3>Phase 2: Peak Demand Management (Weeks 5-8)</h3>
              <p>
                We implemented automated scheduling for new server deployments and high-power maintenance activities:
              </p>
              <ul>
                <li>Server power-on sequences scheduled for off-peak hours</li>
                <li>Battery testing moved to overnight periods</li>
                <li>Pre-cooling initiated before predicted high-load periods</li>
                <li>Real-time alerts when approaching monthly peak threshold</li>
              </ul>
              <p>
                The facility's peak demand dropped from 780 kW to 612 kW-a 21.5% reduction that directly translates
                to lower demand charges every month.
              </p>

              <h3>Phase 3: Time-of-Use Arbitrage (Weeks 9-12)</h3>
              <p>
                With cooling and demand optimized, we focused on shifting flexible loads to cheaper hours:
              </p>
              <ul>
                <li>Pre-cooling the facility during off-peak hours (11 PM - 7 AM at $0.065/kWh)</li>
                <li>Running backup generator tests during mid-peak instead of on-peak</li>
                <li>Scheduling software updates and system scans for off-peak periods</li>
                <li>Optimizing UPS battery charge cycles to align with cheap power</li>
              </ul>

              <h2>The Results</h2>

              <div className="bg-primary/5 border-l-4 border-primary p-6 my-6">
                <p className="text-lg font-semibold mb-2">
                  Six months after implementation, annual electricity costs dropped from $450,000 to $323,500
                </p>
                <p className="text-2xl font-bold text-primary">
                  $126,500 saved per year (28.1% reduction)
                </p>
              </div>

              <h3>Breakdown of Savings</h3>
              <div className="grid gap-4 my-6">
                <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 p-4">
                  <div className="font-semibold">Cooling optimization</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">$58,000/year</div>
                  <div className="text-sm text-muted-foreground">32% cooling energy reduction</div>
                </div>
                <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-4">
                  <div className="font-semibold">Peak demand management</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">$48,500/year</div>
                  <div className="text-sm text-muted-foreground">21.5% demand reduction</div>
                </div>
                <div className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20 p-4">
                  <div className="font-semibold">Time-of-use arbitrage</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">$20,000/year</div>
                  <div className="text-sm text-muted-foreground">Load shifting to cheap hours</div>
                </div>
              </div>

              <h3>Additional Benefits:</h3>
              <ul>
                <li><strong>Zero downtime:</strong> All optimizations occurred automatically with no service interruptions</li>
                <li><strong>Extended equipment life:</strong> Running cooling at appropriate levels reduces wear on HVAC systems</li>
                <li><strong>Carbon reduction:</strong> 340 tons of CO2 avoided annually by reducing consumption and shifting to cleaner grid hours</li>
                <li><strong>Staff time savings:</strong> Automated scheduling eliminated 15 hours/month of manual coordination</li>
              </ul>

              <h2>ROI Analysis</h2>
              <div className="bg-muted/30 rounded-lg p-6 my-6 space-y-3">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Annual savings</div>
                  <div className="font-semibold text-right">$126,500</div>

                  <div className="text-muted-foreground">Implementation cost</div>
                  <div className="font-semibold text-right">$45,000</div>

                  <div className="text-muted-foreground">Ongoing annual cost</div>
                  <div className="font-semibold text-right">$18,000</div>

                  <div className="border-t pt-2 font-semibold">Net first-year savings</div>
                  <div className="border-t pt-2 font-bold text-green-600 dark:text-green-400 text-right">$81,500</div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">Payback period</span>
                    <span className="text-2xl font-bold text-primary">4.3 months</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">5-year NPV</span>
                    <span className="text-2xl font-bold text-primary">$497,500</span>
                  </div>
                </div>
              </div>

              <h2>What Made This Work</h2>
              <p>
                Three factors were critical to success:
              </p>

              <h3>1. Good Data Foundation</h3>
              <p>
                The facility had existing BMS and PDU metering, which made integration straightforward. Sites without
                this infrastructure may need additional sensors, but the ROI still justifies the investment.
              </p>

              <h3>2. Gradual Automation Rollout</h3>
              <p>
                We didn't flip a switch and hand over control. The system ran in monitoring mode for two weeks, then
                gradually took on more automation as the team gained confidence. This change management approach
                prevented resistance and ensured buy-in.
              </p>

              <h3>3. Continuous Learning</h3>
              <p>
                AI models were retrained monthly as the facility's usage patterns evolved. When the data center added
                50 new racks in month 4, the system adapted within days to optimize the new load profile.
              </p>

              <h2>Lessons for Other Data Centers</h2>
              <p>
                This case study demonstrates that even well-managed facilities have significant optimization opportunities:
              </p>
              <ul>
                <li>20-30% energy cost reduction is achievable without capex investment</li>
                <li>ROI typically occurs within 6-12 months</li>
                <li>Automation eliminates the need for constant manual monitoring</li>
                <li>Uptime and reliability can improve alongside cost savings</li>
              </ul>
              <p>
                The key is moving from reactive energy management (responding to yesterday's usage) to predictive
                optimization (preparing for tomorrow's needs). Data centers are particularly well-suited for this
                approach due to their 24/7 operations, measurable loads, and tolerance for automated control.
              </p>

              <h2>Next Steps</h2>
              <p>
                If your data center is spending $200K+ annually on electricity, you likely have similar optimization
                opportunities. The first step is a baseline analysis to quantify where you're losing money and what
                savings are achievable.
              </p>
              <p>
                Most vendors (including Enalysis) offer free assessments that use your utility bills and basic facility
                data to estimate potential savings. This gives you a data-driven business case before committing to
                implementation.
              </p>
            </CardContent>
          </Card>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Want to see what savings are possible for your facility?
            </p>
            <Button size="lg" asChild>
              <Link href="/demo">
                Request a Free Assessment
              </Link>
            </Button>
          </div>
        </div>
      </article>
    </div>
  )
}
