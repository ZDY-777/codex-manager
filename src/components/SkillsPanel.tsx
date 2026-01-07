import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SkillInfo } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GlassButton } from './ui';

// 剥离 YAML frontmatter，只保留正文
function stripFrontmatter(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith('---')) return content;
  
  const endIndex = trimmed.indexOf('\n---', 3);
  if (endIndex === -1) return content;
  
  return trimmed.slice(endIndex + 4).trim();
}

interface SkillsPanelProps {
  onBack: () => void;
}

const listItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};

export function SkillsPanel({ onBack }: SkillsPanelProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const loadSkills = async () => {
    setLoading(true);
    try {
      const result = await invoke<SkillInfo[]>('scan_skills');
      setSkills(result);
    } catch (error) {
      console.error('加载 skills 失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleSelect = async (skill: SkillInfo) => {
    setSelectedSkill(skill);
    setIsEditing(false);
    try {
      const content = await invoke<string>('read_skill_content', { dirPath: skill.dirPath });
      setEditContent(content);
    } catch (error) {
      console.error('读取 SKILL.md 失败:', error);
      setEditContent('');
    }
  };

  const handleSave = async () => {
    if (!selectedSkill) return;
    try {
      await invoke('save_skill_content', {
        dirPath: selectedSkill.dirPath,
        content: editContent,
      });
      await loadSkills();
      setIsEditing(false);
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const handleDelete = async (skill: SkillInfo) => {
    if (!confirm(`确定删除 "${skill.name}" 吗？这将删除整个 skill 目录！`)) return;
    try {
      await invoke('delete_skill', { dirPath: skill.dirPath });
      if (selectedSkill?.dirPath === skill.dirPath) {
        setSelectedSkill(null);
      }
      await loadSkills();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await invoke('create_skill', {
        name: newName.trim().toLowerCase().replace(/\s+/g, '-'),
        description: newDescription.trim(),
      });
      setIsCreating(false);
      setNewName('');
      setNewDescription('');
      await loadSkills();
    } catch (error) {
      console.error('创建失败:', error);
      alert(String(error));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <GlassButton variant="ghost" size="sm" onClick={onBack}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </GlassButton>
        <h2 className="text-lg font-bold text-gradient">Skills 管理</h2>
        <GlassButton variant="primary" size="sm" onClick={() => setIsCreating(true)}>
          + 新建
        </GlassButton>
      </div>

      {/* 主内容区 - 统一卡片 */}
      <div className="flex-1 glass rounded-2xl overflow-hidden flex min-h-0">
        {/* 左侧列表 */}
        <div className="w-64 flex-shrink-0 border-r border-white/10 flex flex-col">
          <div className="p-3 border-b border-white/10">
            <span className="text-xs text-slate-400 uppercase tracking-wider">列表</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {loading ? (
              <div className="text-center py-8 text-slate-500 text-sm">加载中...</div>
            ) : skills.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">暂无 Skills</div>
            ) : (
              <AnimatePresence>
                {skills.map((skill, index) => (
                  <motion.div
                    key={skill.dirPath}
                    variants={listItemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ delay: index * 0.03 }}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all group ${
                      selectedSkill?.dirPath === skill.dirPath
                        ? 'bg-primary-500/20 text-white glow-border'
                        : 'hover:bg-white/10 text-slate-300'
                    }`}
                    onClick={() => handleSelect(skill)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{skill.name}</h3>
                        {skill.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {skill.description}
                          </p>
                        )}
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {skill.hasScripts && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded-md border border-primary-500/30">
                              scripts
                            </span>
                          )}
                          {skill.hasAssets && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/30">
                              assets
                            </span>
                          )}
                          {skill.hasReferences && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded-md border border-violet-500/30">
                              refs
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(skill);
                        }}
                        className="p-1 text-slate-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedSkill ? (
            <>
              {/* 内容头部 */}
              <div className="flex items-center justify-between p-3 border-b border-white/10">
                <h3 className="font-medium text-white truncate">{selectedSkill.name}</h3>
                <div className="flex gap-2 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <GlassButton
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const content = await invoke<string>('read_skill_content', { dirPath: selectedSkill.dirPath });
                          setEditContent(content);
                          setIsEditing(false);
                        }}
                      >
                        取消
                      </GlassButton>
                      <GlassButton variant="primary" size="sm" onClick={handleSave}>
                        保存
                      </GlassButton>
                    </>
                  ) : (
                    <GlassButton variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                      编辑
                    </GlassButton>
                  )}
                </div>
              </div>
              {/* 内容主体 */}
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 w-full bg-transparent p-4 text-sm font-mono text-slate-300 resize-none focus:outline-none custom-scrollbar"
                />
              ) : (
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-4 prose prose-invert prose-sm max-w-none prose-headings:text-slate-200 prose-headings:font-semibold prose-p:text-slate-400 prose-p:leading-relaxed prose-li:text-slate-400 prose-strong:text-slate-200 prose-code:text-slate-300 prose-code:bg-slate-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-normal prose-pre:bg-slate-900/50 prose-pre:border prose-pre:border-slate-700/50 prose-pre:text-slate-400 prose-a:text-primary-400 prose-blockquote:border-slate-600 prose-blockquote:text-slate-500 prose-hr:border-slate-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripFrontmatter(editContent)}</ReactMarkdown>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <p className="text-sm">选择一个 Skill 查看 SKILL.md</p>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* 创建对话框 */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsCreating(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative glass-strong w-full max-w-md p-6 mx-4"
            >
              <h3 className="text-lg font-bold text-gradient mb-4">新建 Skill</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">名称</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例如: my-awesome-skill"
                    className="input-glass"
                  />
                  <p className="text-xs text-slate-500 mt-1">将自动转为小写并用连字符连接</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">描述</label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="描述这个 skill 的用途..."
                    rows={3}
                    className="input-glass resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <GlassButton variant="ghost" onClick={() => setIsCreating(false)}>
                  取消
                </GlassButton>
                <GlassButton variant="primary" onClick={handleCreate}>
                  创建
                </GlassButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
