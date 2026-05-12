export function HowItWorks() {
  const steps = [
    {
      emoji: '🤖',
      title: 'AI Monitors 8 Stores',
      description: 'Our scrapers run 3× daily across Amazon, Flipkart, Myntra, Meesho, Nykaa, Croma, TataCliq & more — tracking hundreds of categories automatically.',
      color: '#818CF8',
    },
    {
      emoji: '📊',
      title: 'Every Deal is Scored',
      description: 'Each deal is scored 0–100 using discount depth, brand reputation, customer ratings, and price history — not just the biggest sale sticker.',
      color: 'var(--gold)',
    },
    {
      emoji: '🎯',
      title: 'You See Only the Best',
      description: 'We surface the highest-scored deals, ranked by true value — so you never waste time scrolling through mediocre offers.',
      color: 'var(--score-high)',
    },
  ];

  return (
    <section
      id="how-it-works"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
    >
      <div className="text-center mb-12">
        <span
          className="text-xs font-bold uppercase tracking-[0.15em] mb-3 block"
          style={{ color: 'var(--gold)' }}
        >
          Powered by AI
        </span>
        <h2
          className="text-2xl md:text-3xl font-black text-white"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          How ShadowMerchant Works
        </h2>
        <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: 'var(--text-muted)' }}>
          No human curation. No sponsored placements. Just AI finding you the best deals automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step, i) => (
          // F5: Wrap each card in a relative container so the connector arrow is
          // positioned relative to the card, NOT the grid — avoids Safari clip bug
          // where overflow:hidden on the card itself would clip the -right-4 arrow.
          <div key={step.title} className="relative">
            <div
              className="flex flex-col p-6 rounded-2xl h-full"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--sm-border)',
              }}
            >
              {/* Step number watermark */}
              <span
                className="absolute top-4 right-5 text-6xl font-black opacity-[0.06] select-none pointer-events-none"
                style={{ color: step.color, fontFamily: 'var(--font-display)' }}
              >
                {i + 1}
              </span>

              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-5 flex-shrink-0"
                style={{ background: `${step.color}18`, border: `1px solid ${step.color}30` }}
              >
                {step.emoji}
              </div>
              <h3 className="font-bold text-white text-lg mb-2">{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {step.description}
              </p>
            </div>

            {/* F5: Connector arrow — on the wrapper div so it's never clipped */}
            {i < steps.length - 1 && (
              <div
                className="hidden md:flex items-center justify-center absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full"
                style={{ background: 'var(--bg-base)', color: 'var(--text-muted)', fontSize: '18px' }}
              >
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
