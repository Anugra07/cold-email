import { Card, CardContent } from "@/components/ui/card";
import { Search, Mail, FileText, Eye } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: Search,
      title: "Smart Contact Discovery",
      description: "Instantly identify and extract verified contact information for hiring managers, recruiters, and decision-makers at any target company."
    },
    {
      icon: Mail,
      title: "Hyper-Personalized Outreach",
      description: "Generate compelling, tailored cold emails that reference recent company news, role requirements, and recipient background."
    },
    {
      icon: FileText,
      title: "Dynamic Resume Optimization",
      description: "Automatically customize your resume for each application, highlighting the most relevant skills and experiences."
    },
    {
      icon: Eye,
      title: "Complete Transparency",
      description: "See exactly how our AI crafts each message and resume, building your confidence while you learn effective outreach strategies."
    }
  ];

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            What Makes Us Different
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our AI-powered platform combines precision targeting with personalized outreach that actually gets responses.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="group hover:shadow-card transition-all duration-300 border-0 bg-gradient-subtle">
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-hero rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;