'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ColorPicker } from 'antd';
import { Palette, Save, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getProjectAppearanceSettings, createProjectAppearanceSettings, updateProjectAppearanceSettings } from '@/lib/api';

export default function AppearanceSettingsPage({ params }) {
  const unwrappedParams = React.use(params);
  const { projectId } = unwrappedParams;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(true);

  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [settings, setSettings] = useState({
    dimensionColor: '#ffffff',
    plotColor: '#3B82F6',
    plotLabelColor: '#ffffff'
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const data = await getProjectAppearanceSettings(projectId);
        if (data) {
          setSettings({
            dimensionColor: data.dimensionColor || '#ffffff',
            plotColor: data.plotColor || '#3B82F6',
            plotLabelColor: data.plotLabelColor || '#ffffff'
          });
          setIsNew(false);
        }
      } catch (err) {
        console.error('Failed to fetch settings', err);
        setError('Failed to load appearance settings.');
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      fetchSettings();
    }
  }, [projectId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage('');

    try {
      if (isNew) {
        await createProjectAppearanceSettings(projectId, settings);
        setIsNew(false);
      } else {
        await updateProjectAppearanceSettings(projectId, settings);
      }
      setSuccessMessage('Appearance settings saved successfully!');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Failed to save settings', err);
      setError(err.message || 'Failed to save appearance settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/cad-conversion/${projectId}`}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Palette className="w-5 h-5 text-blue-400" />
              </div>
              <h1 className="text-lg font-semibold text-white">Appearance Settings</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSave} className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-8">

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3 text-green-400">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{successMessage}</p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-white mb-1">Color Theme</h2>
              <p className="text-sm text-zinc-400 mb-6">Customize the primary colors for plots and dimensions in this project.</p>
            </div>

            {/* Dimension Color */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <label className="text-sm font-medium text-zinc-300">Dimension Color</label>
              </div>
              <div className="sm:col-span-2 flex items-center gap-4">
                <div className="flex-1">
                  <ColorPicker
                    value={settings.dimensionColor}
                    onChange={(_, hex) => setSettings(prev => ({ ...prev, dimensionColor: hex }))}
                    showText
                    format="hex"
                    className="w-full"
                    styles={{
                      popup: { zIndex: 9999 }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Plot Color */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center pt-6 border-t border-white/5">
              <div>
                <label className="text-sm font-medium text-zinc-300">Plot Color</label>
              </div>
              <div className="sm:col-span-2 flex items-center gap-4">
                <div className="flex-1">
                  <ColorPicker
                    value={settings.plotColor}
                    onChange={(_, hex) => setSettings(prev => ({ ...prev, plotColor: hex }))}
                    showText
                    format="hex"
                    className="w-full"
                    styles={{
                      popup: { zIndex: 9999 }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Plot Label Color */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center pt-6 border-t border-white/5">
              <div>
                <label className="text-sm font-medium text-zinc-300">Plot Label Color</label>
              </div>
              <div className="sm:col-span-2 flex items-center gap-4">
                <div className="flex-1">
                  <ColorPicker
                    value={settings.plotLabelColor}
                    onChange={(_, hex) => setSettings(prev => ({ ...prev, plotLabelColor: hex }))}
                    showText
                    format="hex"
                    className="w-full"
                    styles={{
                      popup: { zIndex: 9999 }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
