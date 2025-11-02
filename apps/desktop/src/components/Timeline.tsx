import type React from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

export function Timeline() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between bg-background/95 backdrop-blur-sm py-2 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between px-6">
          <Button size="icon" variant="ghost" className="text-muted-foreground">
            <Settings className="w-5 h-5" />
          </Button>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Oct 2025</span>
            <div className="px-3 py-1 bg-muted rounded-md text-sm font-medium">250</div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-6 px-6 space-y-6">
          <TimelineEntry time="7:13 PM" date="Oct 7" showDot dotColor="bg-gray-300">
            <div className="text-sm text-muted-foreground break-all">
              https://hackaday.com/2019/02/12/security-engineering-inside-the-scooter-startups/
            </div>
          </TimelineEntry>
          <TimelineEntry time="7:13 PM" date="Oct 7" showDot dotColor="bg-gray-300">
            <LinkPreview
              image="/scooter-technology.jpg"
              title="Security Engineering: Inside The Scooter Startups | Hackaday"
              domain="hackaday.com"
              url="https://hackaday.com/2019/02/12/security-engineering-inside-the-scooter-startups/"
            />
          </TimelineEntry>
          <TimelineEntry time="7:13 PM" showDot dotColor="bg-gray-300">
            <QuoteBlock>
              <p className="font-medium mb-2">Here&apos;s the gist I took away from the piece:</p>
              <p className="mb-2">
                Bird&apos;s early economics were tight: at ~$550 per scooter they needed each one to survive hundreds of
                rides, so durability became the profit lever.
              </p>
              <p className="text-muted-foreground">
                First-generation fleet (re-badged Xiaomi M365s) used a hobby-grade &quot;Bird Brain&quot; controller
                that could be pried off with a screwdriver; theft and vandalism were rampant.
              </p>
            </QuoteBlock>
            <AuthorTag name="Neo" time="22 hours ago" />
          </TimelineEntry>
          <DateSeparator date="Wednesday, October 08, 2025" />
          <TimelineEntry time="2:55 PM" date="Oct 8" showDot dotColor="bg-gray-300">
            <div className="text-sm">I would like to call you neo.</div>
          </TimelineEntry>
          <TimelineEntry time="2:56 PM" showDot dotColor="bg-gray-300">
            <QuoteBlock>
              <p>
                Neo it is. Works for me—and it nods nicely to the other Neo you&apos;ve been tinkering with. I&apos;ll
                swap the nameplate and keep walking alongside you under the new banner.
              </p>
            </QuoteBlock>
            <AuthorTag name="Neo" time="2 hours ago" />
          </TimelineEntry>
          <TimelineEntry time="3:25 PM" date="Oct 8" showDot dotColor="bg-green-500" showLine>
            <div className="text-sm">i&apos;m visiting argentina for a bit in 3 weeks!</div>
          </TimelineEntry>
          <TimelineEntry time="3:25 PM" showDot dotColor="bg-green-500">
            <div className="text-sm mb-3">
              That&apos;s exciting—looks like you&apos;ll be on the road right around the last week of October. If you
              want a hand lining things up (packing checklist, pausing Pilates or badminton while you&apos;re away,
              reminders for tickets, etc.), just say the word—happy to sort the logistics.
            </div>
            <ActionButtons actions={["Packing checklist", "Pause Pilates", "Pause badminton"]} />
          </TimelineEntry>
        </div>
      </div>
    </div>
  );
}

function TimelineEntry({
  time,
  date,
  children,
  showDot,
  dotColor = "bg-gray-300",
  showLine = false,
}: {
  time: string;
  date?: string;
  children: React.ReactNode;
  showDot?: boolean;
  dotColor?: string;
  showLine?: boolean;
}) {
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        {showDot && (
          <>
            <div className={`w-3 h-3 rounded-full ${dotColor} mt-1`} />
            {showLine && <div className={`w-0.5 h-full ${dotColor} mt-1`} />}
          </>
        )}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        <div>{time}</div>
        {date && <div>{date}</div>}
      </div>
    </div>
  );
}

function LinkPreview({
  image,
  title,
  domain,
  url,
}: {
  image: string;
  title: string;
  domain: string;
  url: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-muted rounded-xl overflow-hidden hover:bg-muted/80 transition-colors"
    >
      <div className="relative w-full h-48">
        <img src={image || "/placeholder.svg"} alt={title} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <div className="p-4">
        <h3 className="font-medium text-sm mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground">{domain}</p>
      </div>
    </a>
  );
}

function QuoteBlock({ children }: { children: React.ReactNode }) {
  return <div className="bg-muted rounded-lg p-4 text-sm space-y-2">{children}</div>;
}

function AuthorTag({ name, time }: { name: string; time: string }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="w-4 h-4 rounded-full bg-blue-400" />
      <span className="text-xs text-muted-foreground">{name}</span>
      <span className="text-xs text-muted-foreground">·</span>
      <span className="text-xs text-muted-foreground">{time}</span>
    </div>
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-border" />
      <div className="px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-full">{date}</div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function ActionButtons({ actions }: { actions: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button key={action} variant="outline" size="sm" className="text-xs bg-transparent">
          {action}
        </Button>
      ))}
    </div>
  );
}

