import { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface GlassButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  /** 按钮变体 */
  variant?: ButtonVariant;
  /** 按钮尺寸 */
  size?: ButtonSize;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否加载中 */
  loading?: boolean;
  /** 图标（左侧） */
  icon?: ReactNode;
  /** 自定义类名 */
  className?: string;
}

/**
 * 根据变体获取样式类
 */
function getVariantClasses(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':
      return 'bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white shadow-lg hover:shadow-glow';
    case 'secondary':
      return 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 hover:border-white/25 backdrop-blur-sm';
    case 'ghost':
      return 'bg-transparent hover:bg-white/10 text-slate-300 hover:text-white';
    case 'danger':
      return 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white';
  }
}

/**
 * 根据尺寸获取样式类
 */
function getSizeClasses(size: ButtonSize): string {
  switch (size) {
    case 'sm':
      return 'px-3 py-1.5 text-sm rounded-lg';
    case 'lg':
      return 'px-6 py-3 text-base rounded-xl';
    case 'md':
    default:
      return 'px-4 py-2 text-sm rounded-xl';
  }
}

/**
 * 加载动画组件
 */
function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * 玻璃效果按钮组件
 */
export function GlassButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className = '',
  ...motionProps
}: GlassButtonProps) {
  const variantClasses = getVariantClasses(variant);
  const sizeClasses = getSizeClasses(size);
  const disabledClasses = disabled || loading
    ? 'opacity-50 cursor-not-allowed'
    : 'cursor-pointer';
  
  return (
    <motion.button
      className={`
        inline-flex items-center justify-center gap-2 font-medium
        transition-all duration-300
        ${variantClasses}
        ${sizeClasses}
        ${disabledClasses}
        ${className}
      `}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.02 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
      {...motionProps}
    >
      {loading ? (
        <LoadingSpinner />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </motion.button>
  );
}

export default GlassButton;
