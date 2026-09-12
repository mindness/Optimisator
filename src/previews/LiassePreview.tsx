import React from 'react';

export const LiassePreview = () => (
  <div className="p-8 bg-[#E8E4D9] min-h-screen text-[#111827] font-sans">
    <header className="mb-8 border-b-2 border-[#111827] pb-2">
      <h1 className="text-xl font-bold tracking-tight">Liasse Fiscale - Année 2026</h1>
    </header>
    <div className="grid grid-cols-12 gap-1 border-t border-l border-[#111827]">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="col-span-12 grid grid-cols-12 border-b border-r border-[#111827]">
          <div className="col-span-8 p-2 border-r border-[#111827] bg-[#D1D5DB] font-medium">Libellé {i + 1}</div>
          <div className="col-span-4 p-2 text-right font-mono tabular-nums">10 000,00 €</div>
        </div>
      ))}
    </div>
  </div>
);
