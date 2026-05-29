import Hero from "../components/hero/Hero";
import WhoWeAre from "../components/who-we-are/WhoWeAre";
import FeaturedClass from "../components/featured-class/FeaturedClass";
import ChooseUs from "../components/choose-us/ChooseUs";
import BMI from "../components/bmi/BMI";
import PricingCards from "../components/pricing/PricingCards";

function Home() {
  return (
    <main>
      <Hero />
      <WhoWeAre />
      <FeaturedClass />
      <ChooseUs />
  
      <BMI />
      <PricingCards />
    </main>
  );
}

export default Home;
