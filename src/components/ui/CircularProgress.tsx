import { motion } from 'framer-motion';

export interface CircularProgressProps {
  /** 已使用百分比 0-100 */
  value: number;
  /** 圆环尺寸 */
  size?: number;
  /** 线条宽度 */
  strokeWidth?: number;
  /** 标签文字 */
  label?: string;
  /** 是否显示百分比 */
  showPercentage?: boolean;
  /** 自定义类名 */
  className?: string;
}

export type ProgressColorState = 'success' | 'warning' | 'danger';

/**
 * 根据剩余百分比获取颜色状态
 * @param value 已使用百分比
 * @returns 颜色状态
 */
export function getProgressColorState(value: number): ProgressColorState {
  const remaining = 100 - value;
  if (remaining <= 10) return 'danger';
  if (remaining <= 30) return 'warning';
  return 'success';
}

/**
 * 根据颜色状态获取 stroke 颜色类
 */
export function getStrokeColorClass(state: ProgressColorState): string {
  switch (state) {
    case 'danger':
      return 'stroke-rose-500';
    case 'warning':
      return 'stroke-amber-500';
    case 'success':
      return 'stroke-emerald-500';
  }
}

/**
 * 根据颜色状态获取文字颜色类
 */
export function getTextColorClass(state: ProgressColorState): string {
  switch (state) {
    case 'danger':
      return 'text-rose-400';
    case 'warning':
      return 'text-amber-400';
    case 'success':
      return 'text-emerald-400';
  }
}

/**
 * 根据颜色状态获取发光滤镜
 */
function getGlowFilter(state: ProgressColorState): string {
  switch (state) {
    case 'danger':
      return 'drop-shadow(0 0 6px rgba(244, 63, 94, 0.5))';
    case 'warning':
      return 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.5))';
    case 'success':
      return 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.5))';
  }
}

/**
 * 环形进度指示器组件
 */
export function CircularProgress({
  value,
  size = 80,
  strokeWidth = 8,
  label,
  showPercentage = true,
  className = '',
}: CircularProgressProps) {
  // 确保 value 在 0-100 范围内
  const clampedValue = Math.max(0, Math.min(100, value));
  const remaining = Math.round(100 - clampedValue);
  
  const colorState = getProgressColorState(clampedValue);
  const strokeColorClass = getStrokeColorClass(colorState);
  const textColorClass = getTextColorClass(colorState);
  const glowFilter = getGlowFilter(colorState);
  
  // SVG 计算
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;
  const center = size / 2;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        style={{ filter: glowFilter }}
      >
        {/* 背景圆环 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-700/50"
        />
        
        {/* 进度圆环 */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={strokeColorClass}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      
      {/* 中心文字 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercentage && (
          <span className={`text-sm font-bold ${textColorClass}`}>
            {remaining}%
          </span>
        )}
        {label && (
          <span className="text-[8px] text-slate-500 uppercase tracking-wider">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export default CircularProgress;
