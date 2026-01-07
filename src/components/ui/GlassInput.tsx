import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 标签文字 */
  label?: string;
  /** 错误信息 */
  error?: string;
  /** 提示文字 */
  hint?: string;
  /** 自定义类名 */
  className?: string;
  /** 容器类名 */
  containerClassName?: string;
}

export interface GlassTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 标签文字 */
  label?: string;
  /** 错误信息 */
  error?: string;
  /** 提示文字 */
  hint?: string;
  /** 自定义类名 */
  className?: string;
  /** 容器类名 */
  containerClassName?: string;
}

/**
 * 玻璃效果输入框组件
 */
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, hint, className = '', containerClassName = '', ...props }, ref) => {
    const inputClasses = `
      w-full px-4 py-2.5 
      bg-slate-900/50 border rounded-xl 
      text-white placeholder-slate-500 
      focus:outline-none focus:bg-slate-900/70 
      transition-all duration-300
      ${error 
        ? 'border-rose-500/50 focus:border-rose-500 focus:shadow-glow-rose' 
        : 'border-white/10 focus:border-primary-500/50 focus:shadow-glow'
      }
      ${className}
    `;

    return (
      <div className={containerClassName}>
        {label && (
          <label className="block text-sm font-medium text-slate-400 mb-1.5">
            {label}
          </label>
        )}
        <input ref={ref} className={inputClasses} {...props} />
        {error && (
          <p className="mt-1.5 text-xs text-rose-400">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';

/**
 * 玻璃效果文本域组件
 */
export const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  ({ label, error, hint, className = '', containerClassName = '', ...props }, ref) => {
    const textareaClasses = `
      w-full px-4 py-3 
      bg-slate-900/50 border rounded-xl 
      text-white placeholder-slate-500 
      focus:outline-none focus:bg-slate-900/70 
      transition-all duration-300 resize-none
      ${error 
        ? 'border-rose-500/50 focus:border-rose-500 focus:shadow-glow-rose' 
        : 'border-white/10 focus:border-primary-500/50 focus:shadow-glow'
      }
      ${className}
    `;

    return (
      <div className={containerClassName}>
        {label && (
          <label className="block text-sm font-medium text-slate-400 mb-1.5">
            {label}
          </label>
        )}
        <textarea ref={ref} className={textareaClasses} {...props} />
        {error && (
          <p className="mt-1.5 text-xs text-rose-400">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
        )}
      </div>
    );
  }
);

GlassTextarea.displayName = 'GlassTextarea';

export default GlassInput;
