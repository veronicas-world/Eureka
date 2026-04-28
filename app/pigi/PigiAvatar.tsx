'use client'

import { useState } from 'react'

export type PigiMood = 'idle' | 'sleepy' | 'excited'

interface Props {
  size?: number
  /** Which sketch to show. Defaults to "idle". */
  mood?: PigiMood
  /** Override the image src directly (rare — usually use `mood`). */
  src?:  string
}

const moodSrc: Record<PigiMood, string> = {
  idle:    '/pigi/idle.png',
  sleepy:  '/pigi/sleepy.png',
  excited: '/pigi/excited.png',
}

/**
 * Pigi's portrait. Falls back to a soft star glyph if the sketch hasn't
 * been saved to /public/pigi/ yet — so the page never shows a broken
 * image icon while Veronica drops in the scanned art.
 */
export default function PigiAvatar({ size = 96, mood = 'idle', src }: Props) {
  const [imageOk, setImageOk] = useState(true)
  const resolvedSrc = src ?? moodSrc[mood]

  return (
    <div
      style={{
        width:        size,
        height:       size,
        flexShrink:   0,
        position:     'relative',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
      }}
    >
      {imageOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedSrc}
          alt={`pigi (${mood})`}
          onError={() => setImageOk(false)}
          style={{
            width:        '100%',
            height:       '100%',
            objectFit:    'contain',
            // Multiply blends the white paper background of the scanned sketch
            // into whatever sits behind it, so pigi appears to float on the
            // page's off-white surface instead of sitting in a hard square.
            mixBlendMode: 'multiply',
          }}
        />
      ) : (
        <span
          style={{
            fontSize:     size * 0.42,
            color:        'var(--ink-faint, #a4a8c0)',
            opacity:      0.65,
            lineHeight:   1,
          }}
        >
          ✦
        </span>
      )}
    </div>
  )
}
