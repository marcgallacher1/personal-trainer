import { PageTitle } from '../../app/Layout'
import { ComingSoon } from '../../components/ComingSoon'

export function ProgressScreen() {
  return (
    <>
      <PageTitle>Progress</PageTitle>
      <ComingSoon phase="Phase 5">
        Volume per muscle, e1RM trends, PRs, heatmaps and consistency charts.
      </ComingSoon>
    </>
  )
}
