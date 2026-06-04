import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

import { Fonts, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SensorySandboxProps {
  visible: boolean;
  onClose: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface Segment {
  p1: Point;
  p2: Point;
}

interface Circle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
}

interface Rectangle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function SensorySandbox({ visible, onClose }: SensorySandboxProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  const canvasRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [dimensions, setDimensions] = useState({ width: 350, height: 400 });
  const [light, setLight] = useState<Point>({ x: 175, y: 200 });
  
  // Sandbox parameters
  const [quality, setQuality] = useState<'low' | 'high'>('low');
  const [driftEnabled, setDriftEnabled] = useState(true);

  // Instantiate static obstacles
  const obstaclesRef = useRef<{ circles: Circle[]; rectangles: Rectangle[] }>({
    circles: [
      { x: 80, y: 100, r: 35, vx: 0.8, vy: 0.6 },
      { x: 260, y: 90, r: 30, vx: -0.6, vy: 0.9 },
      { x: 180, y: 280, r: 40, vx: 0.5, vy: -0.7 },
    ],
    rectangles: [
      { x: 50, y: 200, w: 70, h: 50 },
      { x: 220, y: 190, w: 80, h: 70 },
    ],
  });

  const onLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
      // Put light source in center initially
      setLight({ x: width / 2, y: height / 2 });
      
      // Scale coordinates of obstacles to fit layout
      obstaclesRef.current = {
        circles: [
          { x: width * 0.23, y: height * 0.25, r: Math.min(width, height) * 0.09, vx: 0.8, vy: 0.6 },
          { x: width * 0.74, y: height * 0.22, r: Math.min(width, height) * 0.08, vx: -0.6, vy: 0.9 },
          { x: width * 0.51, y: height * 0.72, r: Math.min(width, height) * 0.11, vx: 0.5, vy: -0.7 },
        ],
        rectangles: [
          { x: width * 0.14, y: height * 0.5, w: width * 0.2, h: height * 0.12 },
          { x: width * 0.63, y: height * 0.48, w: width * 0.22, h: height * 0.15 },
        ],
      };
    }
  };

  const handleTouch = (evt: any) => {
    const { locationX, locationY } = evt.nativeEvent;
    if (locationX != null && locationY != null) {
      // Clamp coordinates to layout bounds
      const x = Math.max(10, Math.min(dimensions.width - 10, locationX));
      const y = Math.max(10, Math.min(dimensions.height - 10, locationY));
      setLight({ x, y });
    }
  };

  // Main canvas animation render loop
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { width, height } = dimensions;
      const { circles, rectangles } = obstaclesRef.current;

      // 1. Update circle drift
      if (driftEnabled) {
        circles.forEach((c) => {
          c.x += c.vx;
          c.y += c.vy;

          // Bounce collision checks
          if (c.x - c.r < 0) {
            c.x = c.r;
            c.vx *= -1;
          }
          if (c.x + c.r > width) {
            c.x = width - c.r;
            c.vx *= -1;
          }
          if (c.y - c.r < 0) {
            c.y = c.r;
            c.vy *= -1;
          }
          if (c.y + c.r > height) {
            c.y = height - c.r;
            c.vy *= -1;
          }
        });
      }

      // 2. Assemble boundary segments
      const segments: Segment[] = [
        { p1: { x: 0, y: 0 }, p2: { x: width, y: 0 } },
        { p1: { x: width, y: 0 }, p2: { x: width, y: height } },
        { p1: { x: width, y: height }, p2: { x: 0, y: height } },
        { p1: { x: 0, y: height }, p2: { x: 0, y: 0 } },
      ];

      // Add box segments
      rectangles.forEach((r) => {
        segments.push(
          { p1: { x: r.x, y: r.y }, p2: { x: r.x + r.w, y: r.y } },
          { p1: { x: r.x + r.w, y: r.y }, p2: { x: r.x + r.w, y: r.y + r.h } },
          { p1: { x: r.x + r.w, y: r.y + r.h }, p2: { x: r.x, y: r.y + r.h } },
          { p1: { x: r.x, y: r.y + r.h }, p2: { x: r.x, y: r.y } }
        );
      });

      // 3. Gather angles to cast rays
      const uniqueAngles = new Set<number>();

      // Boundary corners
      const corners = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];
      corners.forEach((p) => {
        uniqueAngles.add(Math.atan2(p.y - light.y, p.x - light.x));
      });

      // Rectangle vertices (corners + slight offset to test beyond boundaries)
      rectangles.forEach((r) => {
        const points = [
          { x: r.x, y: r.y },
          { x: r.x + r.w, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h },
        ];
        points.forEach((p) => {
          const angle = Math.atan2(p.y - light.y, p.x - light.x);
          uniqueAngles.add(angle);
          uniqueAngles.add(angle - 0.0001);
          uniqueAngles.add(angle + 0.0001);
        });
      });

      // Circle tangents (where light meets circle edge)
      circles.forEach((c) => {
        const dx = c.x - light.x;
        const dy = c.y - light.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > c.r) {
          const angleToCenter = Math.atan2(dy, dx);
          const angleOffset = Math.asin(c.r / dist);
          const t1 = angleToCenter - angleOffset;
          const t2 = angleToCenter + angleOffset;
          uniqueAngles.add(t1);
          uniqueAngles.add(t1 - 0.0001);
          uniqueAngles.add(t1 + 0.0001);
          uniqueAngles.add(t2);
          uniqueAngles.add(t2 - 0.0001);
          uniqueAngles.add(t2 + 0.0001);
        }
      });

      // Inject extra angles for soft ambient glow quality scaling
      const extraCount = quality === 'high' ? 90 : 36;
      for (let i = 0; i < extraCount; i++) {
        uniqueAngles.add((i / extraCount) * Math.PI * 2);
      }

      // 4. Trace intersections
      const intersections: { x: number; y: number; angle: number }[] = [];

      uniqueAngles.forEach((angle) => {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        let closestT = Infinity;
        let hitX = light.x;
        let hitY = light.y;

        // Trace segments
        segments.forEach((seg) => {
          const r_px = light.x;
          const r_py = light.y;
          const s_px = seg.p1.x;
          const s_py = seg.p1.y;
          const s_dx = seg.p2.x - seg.p1.x;
          const s_dy = seg.p2.y - seg.p1.y;

          const denom = dx * s_dy - dy * s_dx;
          if (Math.abs(denom) > 0.00001) {
            const t = (s_px * s_dy - s_py * s_dx - r_px * s_dy + r_py * s_dx) / denom;
            const u = (r_px * dy - r_py * dx - s_px * dy + s_py * dx) / -denom;

            if (t > 0 && u >= 0 && u <= 1) {
              if (t < closestT) {
                closestT = t;
                hitX = light.x + dx * t;
                hitY = light.y + dy * t;
              }
            }
          }
        });

        // Trace circles
        circles.forEach((c) => {
          const fx = light.x - c.x;
          const fy = light.y - c.y;

          const b = fx * dx + fy * dy;
          const cc = (fx * fx + fy * fy) - c.r * c.r;
          const disc = b * b - cc;

          if (disc >= 0) {
            const t1 = -b - Math.sqrt(disc);
            const t2 = -b + Math.sqrt(disc);

            if (t1 > 0 && t1 < closestT) {
              closestT = t1;
              hitX = light.x + dx * t1;
              hitY = light.y + dy * t1;
            } else if (t2 > 0 && t2 < closestT) {
              closestT = t2;
              hitX = light.x + dx * t2;
              hitY = light.y + dy * t2;
            }
          }
        });

        if (closestT < Infinity) {
          intersections.push({ x: hitX, y: hitY, angle });
        }
      });

      // Sort by angle around light source
      intersections.sort((a, b) => a.angle - b.angle);

      // 5. Drawing Canvas
      ctx.clearRect(0, 0, width, height);

      // Draw dark background
      ctx.fillStyle = '#121517';
      ctx.fillRect(0, 0, width, height);

      // Draw light polygon
      if (intersections.length > 0) {
        ctx.beginPath();
        ctx.moveTo(intersections[0].x, intersections[0].y);
        for (let i = 1; i < intersections.length; i++) {
          ctx.lineTo(intersections[i].x, intersections[i].y);
        }
        ctx.closePath();

        const grad = ctx.createRadialGradient(
          light.x,
          light.y,
          5,
          light.x,
          light.y,
          Math.max(width, height) * 0.7
        );
        grad.addColorStop(0, 'rgba(233, 30, 99, 0.4)'); // Pink glow center
        grad.addColorStop(0.25, 'rgba(233, 30, 99, 0.12)');
        grad.addColorStop(0.65, 'rgba(233, 30, 99, 0.02)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Draw light rays beams
      ctx.strokeStyle = 'rgba(233, 30, 99, 0.04)';
      ctx.lineWidth = 1;
      intersections.forEach((p) => {
        ctx.beginPath();
        ctx.moveTo(light.x, light.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      });

      // Draw obstacle boxes
      ctx.fillStyle = '#1D222B';
      ctx.strokeStyle = '#2A313E';
      ctx.lineWidth = 2.5;
      rectangles.forEach((r) => {
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      });

      // Draw obstacle circles
      circles.forEach((c) => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // Draw glowing light source core
      ctx.beginPath();
      ctx.arc(light.x, light.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#E91E63';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#E91E63';
      ctx.fill();
      ctx.shadowBlur = 0; // reset

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [visible, dimensions, light, driftEnabled, quality]);

  const handleResetObstacles = () => {
    const { width, height } = dimensions;
    obstaclesRef.current = {
      circles: [
        { x: width * (0.15 + Math.random() * 0.2), y: height * (0.15 + Math.random() * 0.2), r: Math.min(width, height) * (0.07 + Math.random() * 0.04), vx: (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.6), vy: (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.6) },
        { x: width * (0.65 + Math.random() * 0.2), y: height * (0.15 + Math.random() * 0.2), r: Math.min(width, height) * (0.07 + Math.random() * 0.04), vx: (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.6), vy: (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.6) },
        { x: width * (0.4 + Math.random() * 0.2), y: height * (0.65 + Math.random() * 0.2), r: Math.min(width, height) * (0.08 + Math.random() * 0.04), vx: (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.6), vy: (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.6) },
      ],
      rectangles: [
        { x: width * 0.15, y: height * 0.45, w: width * 0.2, h: height * 0.12 },
        { x: width * 0.65, y: height * 0.45, w: width * 0.2, h: height * 0.12 },
      ],
    };
    setLight({ x: width / 2, y: height / 2 });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: palette.textPrimary }]}>Sensory Sandbox</Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                Drag your touch to cast calm light. Watch the shadows flow.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close sandbox">
              <Ionicons name="close" size={24} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Canvas container */}
          <View
            style={[styles.canvasWrapper, { borderColor: palette.border, backgroundColor: '#121517' }]}
            onLayout={onLayout}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleTouch}
            onResponderMove={handleTouch}
          >
            {Platform.OS === 'web' ? (
              <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            ) : (
              <View style={styles.nativeFallback}>
                <Ionicons name="alert-circle-outline" size={48} color={palette.textMuted} />
                <Text style={[styles.fallbackText, { color: palette.textSecondary }]}>
                  Sensory Sandbox is available in Web/PWA mode.
                </Text>
              </View>
            )}
          </View>

          {/* Controls Bar */}
          <View style={styles.controlsRow}>
            {/* Drift Control */}
            <TouchableOpacity
              onPress={() => setDriftEnabled((prev) => !prev)}
              style={[
                styles.controlBtn,
                {
                  backgroundColor: palette.surface,
                  borderColor: driftEnabled ? '#E91E63' : palette.borderStrong,
                },
              ]}
            >
              <Ionicons
                name={driftEnabled ? "pause" : "play"}
                size={14}
                color={driftEnabled ? '#E91E63' : palette.textPrimary}
              />
              <Text style={[styles.controlBtnText, { color: palette.textPrimary }]}>
                {driftEnabled ? 'Pause Drift' : 'Start Drift'}
              </Text>
            </TouchableOpacity>

            {/* Quality Control */}
            <TouchableOpacity
              onPress={() => setQuality((prev) => (prev === 'low' ? 'high' : 'low'))}
              style={[
                styles.controlBtn,
                {
                  backgroundColor: palette.surface,
                  borderColor: quality === 'high' ? '#E91E63' : palette.borderStrong,
                },
              ]}
            >
              <Ionicons
                name="options-outline"
                size={14}
                color={quality === 'high' ? '#E91E63' : palette.textPrimary}
              />
              <Text style={[styles.controlBtnText, { color: palette.textPrimary }]}>
                {quality === 'high' ? 'High Quality' : 'Low Quality'}
              </Text>
            </TouchableOpacity>

            {/* Reset Control */}
            <TouchableOpacity
              onPress={handleResetObstacles}
              style={[
                styles.controlBtn,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.borderStrong,
                },
              ]}
            >
              <Ionicons name="shuffle" size={14} color={palette.textPrimary} />
              <Text style={[styles.controlBtnText, { color: palette.textPrimary }]}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Done button */}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            style={[styles.doneButton, { backgroundColor: '#E91E63', borderColor: palette.border }]}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  } as ViewStyle,
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderWidth: 2,
  } as ViewStyle,
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9993',
    marginBottom: 12,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  } as ViewStyle,
  title: {
    fontSize: 22,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  } as TextStyle,
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  } as TextStyle,
  canvasWrapper: {
    height: 320,
    borderRadius: 14,
    borderWidth: 2.5,
    overflow: 'hidden',
    marginBottom: 16,
    ...hardShadow(5),
  } as ViewStyle,
  nativeFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  } as ViewStyle,
  fallbackText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  } as TextStyle,
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  } as ViewStyle,
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    gap: 6,
    ...hardShadow(3),
  } as ViewStyle,
  controlBtnText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Fonts?.sans,
  } as TextStyle,
  doneButton: {
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 2,
    ...hardShadow(4),
  } as ViewStyle,
  doneButtonText: {
    color: '#FFF',
    fontFamily: Fonts?.display,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,
});
