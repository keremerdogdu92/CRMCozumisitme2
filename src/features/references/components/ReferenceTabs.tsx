// src/features/references/components/ReferenceTabs.tsx
// Summary: Small tab bar component for reference detail drawer.

import React from 'react';

export type ReferenceTabId = 'summary' | 'patients' | 'gifts';

type TabDef = {
  id: ReferenceTabId;
  label: string;
};

type ReferenceTabsProps = {
  tabs: TabDef[];
  activeTab: ReferenceTabId;
  onTabChange: (tabId: ReferenceTabId) => void;
};

export const ReferenceTabs: React.FC<ReferenceTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="border-b border-slate-200 px-3 pt-2">
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={
                'rounded-md px-3 py-1.5 text-xs font-medium ' +
                (isActive
                  ? 'bg-primary-50 text-primary-700 border border-primary-200'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent')
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
