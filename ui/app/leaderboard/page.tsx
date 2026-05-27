import { ModelLeaderboard } from "components/ModelLeaderboard";
import { PageContainer } from "components/PageContainer";

export default function LeaderboardPage() {
  return (
    <PageContainer className="flex flex-col items-center">
      <ModelLeaderboard />
    </PageContainer>
  );
}
