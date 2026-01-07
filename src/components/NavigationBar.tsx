import { motion } from 'framer-motion';
import { GlassCard } from './ui';

export type ViewType = 'accounts' | 'prompts' | 'skills' | 'agents' | 'config';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  gradientClass: string;
}

interface NavigationBarProps {
  onNavigate: (view: ViewType) => void;
  onSync: () => void;
}

const navItems: NavItem[] = [
  {
    id: 'prompts',
    label: 'Prompts',
    colorClass: 'text-primary-400',
    gradientClass: 'from-primary-500/20 to-primary-600/10',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'skills',
    label: 'Skills',
    colorClass: 'text-emerald-400',
    gradientClass: 'from-emerald-500/20 to-emerald-600/10',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    id: 'agents',
    label: 'Agents',
    colorClass: 'text-purple-400',
    gradientClass: 'from-purple-500/20 to-purple-600/10',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'config',
    label: 'Config',
    colorClass: 'text-amber-400',
    gradientClass: 'from-amber-500/20 to-amber-600/10',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function NavigationBar({ onNavigate, onSync }: NavigationBarProps) {
  return (
    <motion.div
      className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {navItems.map((item) => (
        <motion.div key={item.id} variants={itemVariants}>
          <GlassCard
            hoverable
            padding="none"
            className={`p-2 sm:p-3 bg-gradient-to-br ${item.gradientClass} group`}
            onClick={() => onNavigate(item.id)}
          >
            <div className="flex flex-col items-center justify-center gap-1 sm:gap-1.5">
              <div className={`${item.colorClass} transition-transform duration-300 group-hover:scale-110`}>
                {item.icon}
              </div>
              <span className="text-[10px] sm:text-xs text-slate-300 font-medium">{item.label}</span>
            </div>
          </GlassCard>
        </motion.div>
      ))}
      
      {/* Sync 按钮 */}
      <motion.div variants={itemVariants}>
        <GlassCard
          hoverable
          padding="none"
          className="p-2 sm:p-3 bg-gradient-to-br from-blue-500/20 to-blue-600/10 group"
          onClick={onSync}
        >
          <div className="flex flex-col items-center justify-center gap-1 sm:gap-1.5">
            <div className="text-blue-400 transition-transform duration-300 group-hover:scale-110">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-300 font-medium">Sync</span>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}

export default NavigationBar;
