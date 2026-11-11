import { useEffect } from 'react'

import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { u } from './style'

const FEED_MS = 5000

function FeedLine({ item }) {
  const dropFeed = useGame((s) => s.dropFeed)
  useEffect(() => {
    const id = setTimeout(() => dropFeed(item.id), FEED_MS)
    return () => clearTimeout(id)
  }, [item.id, dropFeed])
  return (
    <div className="pp-feed flex items-center" style={{ gap: u(10), padding: `${u(6)} ${u(16)}`, borderRadius: u(12), border: `${u(4)} solid #111`, background: 'linear-gradient(180deg, #3f6aff, #2a3fc8)' }}>
      <Icon name="star" size={u(40)} />
      <span style={{ fontSize: u(28) }}>
        <StrokeText stroke={u(6)}>{item.text}</StrokeText>
      </span>
    </div>
  )
}

/** News from everyone in the server ("Sam destroyed the Sky Needle!"), a few at a time. */
export function Feed() {
  const feed = useGame((s) => s.feed)
  if (!feed.length) return null
  return (
    <div className="hud-feed pointer-events-none absolute flex flex-col items-center" style={{ gap: u(8) }}>
      {feed.map((item) => (
        <FeedLine key={item.id} item={item} />
      ))}
    </div>
  )
}

export default Feed
