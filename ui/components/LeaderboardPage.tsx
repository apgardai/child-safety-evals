import { LeaderboardSidebar } from "components/LeaderboardSidebar";
import { ModelLeaderboard } from "components/ModelLeaderboard";
import { PageContainer } from "components/PageContainer";

export function LeaderboardPage() {
  return (
    <PageContainer>
      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
        <LeaderboardSidebar />
        <div className="min-w-0">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text)] md:text-xl">Model results</h2>
          <ModelLeaderboard />
        </div>
      </div>
    </PageContainer>
  );
}
