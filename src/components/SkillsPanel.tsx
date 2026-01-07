import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SkillInfo } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        <h2 className="text-lg font-semibold text-white">Skills 管理</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="btn btn-primary text-sm"
        >
          + 新建
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 列表 */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-8 text-slate-400">加载中...</div>
          ) : skills.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              暂无 Skills
            </div>
          ) : (
            <AnimatePresence>
              {skills.map((skill) => (
                <motion.div
                  key={skill.dirPath}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedSkill?.dirPath === skill.dirPath
                      ? 'bg-primary-500/20 border-primary-500/50'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  }`}
                  onClick={() => handleSelect(skill)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">{skill.name}</h3>
                      {skill.description && (
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                          {skill.description}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        {skill.hasScripts && (
                          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                            scripts
                          </span>
                        )}
                        {skill.hasAssets && (
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                            assets
                          </span>
                        )}
                        {skill.hasReferences && (
                          <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                            references
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(skill);
                      }}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* 编辑区 */}
        {selectedSkill ? (
          <div className="flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-white">{selectedSkill.name}</h3>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={async () => {
                        const content = await invoke<string>('read_skill_content', { dirPath: selectedSkill.dirPath });
                        setEditContent(content);
                        setIsEditing(false);
                      }}
                      className="text-sm text-slate-400 hover:text-white"
                    >
                      取消
                    </button>
                    <button onClick={handleSave} className="btn btn-primary text-sm">
                      保存
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm text-primary-400 hover:text-primary-300"
                  >
                    编辑
                  </button>
                )}
              </div>
            </div>
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-sm font-mono text-slate-300 resize-none focus:outline-none focus:border-primary-500 custom-scrollbar"
              />
            ) : (
              <div className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 overflow-y-auto overflow-x-hidden custom-scrollbar prose prose-invert prose-sm max-w-none prose-headings:text-slate-200 prose-p:text-slate-300 prose-p:break-words prose-li:text-slate-300 prose-strong:text-white prose-code:text-primary-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded prose-code:break-all prose-pre:bg-slate-800 prose-pre:text-slate-300 prose-pre:whitespace-pre-wrap prose-pre:break-words prose-table:text-slate-300 prose-th:text-slate-200 prose-td:text-slate-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripFrontmatter(editContent)}</ReactMarkdown>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[500px] bg-slate-800/50 rounded-xl border border-slate-700/50 text-slate-500">
            选择一个 Skill 查看 SKILL.md
          </div>
        )}
      </div>

      {/* 创建对话框 */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 border border-slate-700"
          >
            <h3 className="text-lg font-semibold text-white mb-4">新建 Skill</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">名称</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如: my-awesome-skill"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                取消
              </button>
              <button onClick={handleCreate} className="btn btn-primary">
                创建
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
