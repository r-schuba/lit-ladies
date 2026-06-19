import React from 'react';
import { View, Text } from 'react-native';

const INK = 'rgba(255,255,255,0.45)';

/** Vine pattern — stem + alternating oval leaves */
function VineSpine({ w, h }: { w: number; h: number }) {
  const stemX = w / 2 - 0.5;
  const leafW = Math.round(w * 0.45);
  const leafH = Math.round(leafW * 0.55);
  const leafOffX = Math.round(w * 0.12);
  const spacing = Math.round(h * 0.18);
  const leaves = [0.18, 0.36, 0.54, 0.72].map((t, i) => ({
    top: Math.round(h * t),
    left: i % 2 === 0 ? leafOffX : w - leafOffX - leafW,
    rotate: i % 2 === 0 ? '-35deg' : '35deg',
  }));

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }}>
      {/* Stem */}
      <View
        style={{
          position: 'absolute',
          top: Math.round(h * 0.1),
          bottom: Math.round(h * 0.08),
          left: stemX,
          width: 1,
          backgroundColor: INK,
          borderRadius: 1,
        }}
      />
      {/* Leaves */}
      {leaves.map((leaf, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: leaf.top,
            left: leaf.left,
            width: leafW,
            height: leafH,
            borderRadius: leafH,
            backgroundColor: INK,
            transform: [{ rotate: leaf.rotate }],
          }}
        />
      ))}
    </View>
  );
}

/** Art deco pattern — fan of horizontal lines + central diamond */
function ArtDecoSpine({ w, h }: { w: number; h: number }) {
  const lineColor = INK;
  const lineH = 1;
  const pad = Math.round(w * 0.08);
  // Stacked lines with decreasing inset (fan effect) in top third
  const lines = [
    { top: Math.round(h * 0.10), inset: 0 },
    { top: Math.round(h * 0.17), inset: Math.round(w * 0.1) },
    { top: Math.round(h * 0.24), inset: Math.round(w * 0.2) },
  ];
  const diamondSize = Math.round(w * 0.42);
  const diamondTop = Math.round(h * 0.50) - diamondSize / 2;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }}>
      {/* Fan lines */}
      {lines.map((line, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: line.top,
            left: pad + line.inset,
            right: pad + line.inset,
            height: lineH,
            backgroundColor: lineColor,
            borderRadius: 1,
          }}
        />
      ))}
      {/* Mirror fan lines in bottom third */}
      {lines.map((line, i) => (
        <View
          key={`b${i}`}
          style={{
            position: 'absolute',
            bottom: line.top,
            left: pad + line.inset,
            right: pad + line.inset,
            height: lineH,
            backgroundColor: lineColor,
            borderRadius: 1,
          }}
        />
      ))}
      {/* Central diamond */}
      <View
        style={{
          position: 'absolute',
          top: diamondTop,
          left: (w - diamondSize) / 2,
          width: diamondSize,
          height: diamondSize,
          backgroundColor: lineColor,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/** Geometric pattern — alternating circle, diamond, square */
function GeometricSpine({ w, h }: { w: number; h: number }) {
  const sz = Math.round(w * 0.42);
  const cx = (w - sz) / 2;
  const shapes = [
    { top: Math.round(h * 0.12), type: 'circle' },
    { top: Math.round(h * 0.36), type: 'diamond' },
    { top: Math.round(h * 0.70), type: 'square' },
  ];

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }}>
      {shapes.map((shape, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: shape.top,
            left: cx,
            width: sz,
            height: sz,
            backgroundColor: INK,
            borderRadius: shape.type === 'circle' ? sz : 1,
            transform: shape.type === 'diamond' ? [{ rotate: '45deg' }] : [],
          }}
        />
      ))}
    </View>
  );
}

export function LitLadiesLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const scale = size === 'sm' ? 0.7 : size === 'lg' ? 1.4 : 1;

  const markSize = Math.round(52 * scale);
  const spineW = Math.round(11 * scale);
  const spineH = Math.round(38 * scale);
  const gap = Math.round(3 * scale);
  const br = Math.round(2 * scale);

  const spineData = [
    { color: '#C4614A', height: spineH, pattern: 'vine' },
    { color: '#8c3e2e', height: Math.round(spineH * 0.84), pattern: 'deco' },
    { color: '#df8256', height: Math.round(spineH * 0.70), pattern: 'geo' },
  ];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(12 * scale) }}>
      {/* Emblem */}
      <View
        style={{
          width: markSize,
          height: markSize,
          borderRadius: Math.round(13 * scale),
          backgroundColor: '#fae8de',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: Math.round(6 * scale),
          overflow: 'hidden',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap }}>
          {spineData.map((spine, i) => (
            <View
              key={i}
              style={{
                width: spineW,
                height: spine.height,
                backgroundColor: spine.color,
                borderRadius: br,
                overflow: 'hidden',
              }}
            >
              {spine.pattern === 'vine' && <VineSpine w={spineW} h={spine.height} />}
              {spine.pattern === 'deco' && <ArtDecoSpine w={spineW} h={spine.height} />}
              {spine.pattern === 'geo' && <GeometricSpine w={spineW} h={spine.height} />}
            </View>
          ))}
        </View>

        {/* Shelf shadow line */}
        <View
          style={{
            position: 'absolute',
            bottom: Math.round(5 * scale),
            left: Math.round(8 * scale),
            right: Math.round(8 * scale),
            height: 2,
            backgroundColor: '#C4614A',
            opacity: 0.2,
            borderRadius: 1,
          }}
        />
      </View>

      {/* Wordmark */}
      <View>
        <Text
          style={{
            fontSize: Math.round(22 * scale),
            fontWeight: '800',
            color: '#3a2218',
            letterSpacing: -0.5,
            lineHeight: Math.round(26 * scale),
          }}
        >
          Lit Ladies
        </Text>
        <Text
          style={{
            fontSize: Math.round(11 * scale),
            fontWeight: '600',
            color: '#C4614A',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginTop: 1,
          }}
        >
          Book Club
        </Text>
      </View>
    </View>
  );
}
