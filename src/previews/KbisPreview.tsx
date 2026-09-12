import React from 'react';

export const KbisPreview = () => (
  <div className="p-8 bg-[#1A1F2E] min-h-screen text-[#F7F5F0] font-serif">
    <header className="border-b border-[#374151] pb-4 mb-8">
      <h1 className="text-2xl font-bold uppercase tracking-widest text-[#1E3A8A]">Extrait Kbis</h1>
      <p className="text-sm opacity-70">Simulation pédagogique SASU</p>
    </header>
    <div className="border-2 border-[#B91C1C] p-6 bg-[#F7F5F0] text-[#111827]">
      <div className="flex justify-between items-start">
        <h2 className="text-xl font-bold">SASU OpCo</h2>
        <span className="bg-[#B91C1C] text-white px-2 py-1 rotate-[-5deg] font-bold">VALIDE</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <p><strong>CA HT :</strong> 120 000 €</p>
        <p><strong>Résultat :</strong> 96 000 €</p>
      </div>
    </div>
  </div>
);
