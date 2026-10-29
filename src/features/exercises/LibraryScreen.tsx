import { Link, useNavigate } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { ExerciseList } from './ExerciseList'

export function LibraryScreen() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-2">
      <Link to="/log" className="text-sm text-accent">
        ‹ Log
      </Link>
      <div className="flex items-end justify-between">
        <PageTitle>Exercises</PageTitle>
        <Link to="/exercises/new" className="mb-4 text-sm font-semibold text-accent">
          + New
        </Link>
      </div>
      <ExerciseList onPick={(e) => void navigate(`/exercises/${e.id}`)} />
    </div>
  )
}
