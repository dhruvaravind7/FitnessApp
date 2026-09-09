import { Link } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import { titleCase } from '../lib/format'
import './ExerciseCard.css'

export default function ExerciseCard({ exercise }) {
  const tags = [...(exercise.bodyParts || []).slice(0, 2), ...(exercise.equipments || []).slice(0, 1)]
  return (
    <Link to={`/exercise/${exercise.exerciseId}`} className="ex-card fade-in" state={{ exercise }}>
      <div className="ex-card-media">
        {exercise.imageUrl ? (
          <img src={exercise.imageUrl} alt={exercise.name} loading="lazy" />
        ) : (
          <div className="ex-card-noimg"><ImageOff size={22} /></div>
        )}
      </div>
      <div className="ex-card-body">
        <p className="ex-card-name">{exercise.name}</p>
        {tags.length > 0 && (
          <div className="tag-row">
            {tags.map((t) => <span key={t} className="tag">{titleCase(t)}</span>)}
          </div>
        )}
      </div>
    </Link>
  )
}

export function ExerciseCardSkeleton() {
  return (
    <div className="ex-card">
      <div className="ex-card-media skeleton" />
      <div className="ex-card-body">
        <div className="skeleton" style={{ height: 16, width: '70%' }} />
        <div className="skeleton" style={{ height: 12, width: '40%', marginTop: 8 }} />
      </div>
    </div>
  )
}
