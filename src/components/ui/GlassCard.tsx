import { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export type GlassVariant = 'default' | 'strong' | 'active' | 'danger';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  /** 玻璃效果变体 */
  variant?: GlassVariant;
  /** 是否启用 hover 效果 */
  hoverable?: boolean;
  /** 活跃状态时是否显示发光边框 */
  glowOnActive?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 内边距 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * 根据变体获取样式类
 */
export function getVariantClasses(variant: GlassVariant, glowOnActive: boolean): string {
  const baseClasses = 'rounded-2xl transition-all duration-300';
  
  switch (variant) {
    case 'strong':
      return `${baseClasses} glass-strong`;
    case 'active':
      return `${baseClasses} glass ${glowOnActive ? 'glow-border-strong' : 'glow-border'} bg-gradient-to-r from-primary-900/30 to-white/10`;
    case 'danger':
      return `${baseClasses} glass glow-border-rose`;
    case 'default':
    default:
      return `${baseClasses} glass`;
  }
}

/**
 * 获取内边距类
 */
function getPaddingClass(padding: GlassCardProps['padding']): string {
  switch (padding) {
    case 'none':
      return '';
    case 'sm':
      return 'p-3';
    case 'lg':
      return 'p-6';
    case 'md':
    default:
      return 'p-4';
  }
}

/**
 * 玻璃效果卡片组件
 */
export function GlassCard({
  children,
  variant = 'default',
  hoverable = false,
  glowOnActive = false,
  className = '',
  padding = 'md',
  ...motionProps
}: GlassCardProps) {
  const variantClasses = getVariantClasses(variant, glowOnActive);
  const paddingClass = getPaddingClass(padding);
  const hoverClasses = hoverable ? 'glass-hover cursor-pointer' : '';
  
  return (
    <motion.div
      className={`${variantClasses} ${paddingClass} ${hoverClasses} ${className}`}
      whileHover={hoverable ? { scale: 1.01 } : undefined}
      whileTap={hoverable ? { scale: 0.99 } : undefined}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

export default GlassCard;
