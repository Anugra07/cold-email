const Stats = () => {
  const stats = [
    {
      number: "300%",
      label: "Increase in Response Rates",
      description: "Average improvement over traditional applications"
    },
    {
      number: "5x",
      label: "Faster Job Placements",
      description: "Land offers quicker than manual methods"
    },
    {
      number: "10k+",
      label: "Successful Job Seekers",
      description: "Professionals who've accelerated their careers"
    },
    {
      number: "24/7",
      label: "AI Working for You",
      description: "Continuous outreach while you sleep"
    }
  ];

  return (
    <section className="py-16 lg:py-24 bg-gradient-hero text-primary-foreground">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Results That Speak for Themselves
          </h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            Join thousands of professionals who've transformed their job search with AI-powered precision.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl lg:text-5xl font-bold mb-2">
                {stat.number}
              </div>
              <div className="text-lg font-semibold mb-2 opacity-90">
                {stat.label}
              </div>
              <div className="text-sm opacity-75">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;