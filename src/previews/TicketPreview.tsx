export const TicketPreview = () => (
  <div className="p-8 bg-[#0B1F3A] min-h-screen font-sans text-[#FFFFFF]">
    <div className="max-w-md mx-auto bg-[#FFFFFF] text-[#0B1F3A] p-6 shadow-xl transform rotate-1">
      <div className="border-b-2 border-dashed border-[#0B1F3A] pb-4 mb-4">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter">Billet Flux Fiscal</h1>
        <p className="text-sm">Voyage OpCo 2026</p>
      </div>
      <div className="space-y-4">
        <div className="flex justify-between border-b border-[#0B1F3A] pb-2">
          <span>SASU OpCo</span>
          <span className="font-mono font-bold">120 000 €</span>
        </div>
        <div className="bg-[#C41E3A] text-white p-2 text-center font-black rotate-[-2deg]">
          VALIDE
        </div>
      </div>
    </div>
  </div>
);
